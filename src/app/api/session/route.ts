import { NextResponse } from "next/server";
import type { Persona, SetupResult } from "@/lib/types";
import { PERSONAS, agentIdFor } from "@/lib/personas";

export const runtime = "nodejs";

interface SessionRequest {
  persona: Persona;
  setup: SetupResult;
  resume?: string;
  jd?: string;
}

export interface SessionResponse {
  agentId: string;
  signedUrl?: string;
  overrides: {
    agent: { prompt?: { prompt: string }; firstMessage: string };
    tts: { voiceId: string };
  };
  dynamicVariables: Record<string, string | number>;
}

const PERSONA_IDS: Persona[] = ["founder", "engineer", "hr"];

function isSetupResult(v: unknown): v is SetupResult {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  const salary = s.salary as Record<string, unknown> | undefined;
  if (!salary) { console.warn("[session] setup missing salary:", JSON.stringify(v).slice(0, 300)); return false; }
  // Coerce in place so a slightly off shape from the model still works.
  s.candidateName = typeof s.candidateName === "string" ? s.candidateName : "Candidate";
  s.roleTitle = typeof s.roleTitle === "string" ? s.roleTitle : "the role";
  s.gaps = Array.isArray(s.gaps) ? s.gaps : [];
  s.themes = Array.isArray(s.themes) ? s.themes : [];
  salary.currency = typeof salary.currency === "string" ? salary.currency : "EUR";
  salary.openingOffer = Number(salary.openingOffer) || 60000;
  salary.ceiling = Number(salary.ceiling) || Math.round((salary.openingOffer as number) * 1.25);
  salary.marketNote = typeof salary.marketNote === "string" ? salary.marketNote : "";
  return true;
}

function parseBody(body: unknown): SessionRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!PERSONA_IDS.includes(b.persona as Persona)) return null;
  if (!isSetupResult(b.setup)) return null;
  return {
    persona: b.persona as Persona,
    setup: b.setup,
    resume: typeof b.resume === "string" ? b.resume : undefined,
    jd: typeof b.jd === "string" ? b.jd : undefined,
  };
}

/** Replace {{var}} placeholders in the first message so the override is literal text. */
function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) =>
    key in vars ? String(vars[key]) : m,
  );
}

async function fetchSignedUrl(agentId: string): Promise<string | undefined> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return undefined;
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": apiKey }, cache: "no-store" },
    );
    if (!res.ok) {
      console.warn(`[session] signed url request failed: ${res.status}`);
      return undefined;
    }
    const data = (await res.json()) as { signed_url?: string };
    return data.signed_url || undefined;
  } catch (err) {
    console.warn("[session] signed url fetch error", err);
    return undefined;
  }
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      { error: "Expected { persona: 'founder'|'engineer'|'hr', setup: SetupResult, resume?, jd? }" },
      { status: 400 },
    );
  }

  const config = PERSONAS[body.persona];
  const { setup } = body;

  let agentId: string;
  try {
    agentId = agentIdFor(config.agent);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent not configured" },
      { status: 500 },
    );
  }

  const clip = (t: string | undefined, n: number) => (t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const dynamicVariables: Record<string, string | number> =
    config.agent === "interviewer"
      ? {
          resume: clip(body.resume, 900),
          jd: clip(body.jd, 700),
          persona_instructions: config.personaInstructions,
          gaps: setup.gaps.join("; "),
          candidate_name: setup.candidateName,
        }
      : {
          candidate_name: setup.candidateName,
          role_title: setup.roleTitle,
          opening_offer: setup.salary.openingOffer,
          ceiling: setup.salary.ceiling,
          currency: setup.salary.currency,
          market_note: setup.salary.marketNote,
        };

  const signedUrl = await fetchSignedUrl(agentId);

  const response: SessionResponse = {
    agentId,
    ...(signedUrl ? { signedUrl } : {}),
    overrides: {
      agent: { firstMessage: fill(config.firstMessage, dynamicVariables) },
      tts: { voiceId: config.voiceId },
    },
    dynamicVariables,
  };

  return NextResponse.json(response);
}
