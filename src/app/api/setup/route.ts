import { NextResponse } from "next/server";
import { structured } from "@/lib/claude";
import type { SetupResult } from "@/lib/types";

const THEMES = ["behavioral", "technical", "conflict", "leadership", "weakness"];

const SETUP_SCHEMA = {
  type: "object",
  properties: {
    candidateName: { type: "string", description: 'Candidate full name from the resume, or "Candidate" if absent' },
    roleTitle: { type: "string", description: "Role title from the job description" },
    gaps: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: { type: "string" },
      description: "2-3 concrete gaps between resume and JD an interviewer should press on",
    },
    themes: {
      type: "array",
      minItems: 4,
      maxItems: 5,
      items: { type: "string", enum: THEMES },
      description: "4-5 question themes to cover",
    },
    salary: {
      type: "object",
      properties: {
        currency: { type: "string", description: "ISO code, e.g. EUR" },
        openingOffer: { type: "number", description: "Annual gross lowball, ~85% of market median" },
        ceiling: { type: "number", description: "Annual gross hidden max, ~110% of market median" },
        marketNote: { type: "string", description: "One sentence on the market band and why" },
      },
      required: ["currency", "openingOffer", "ceiling", "marketNote"],
    },
  },
  required: ["candidateName", "roleTitle", "gaps", "themes", "salary"],
};

const SYSTEM = `You are prepping a mock interview and salary negotiation for a candidate.
Given a resume and a job description:
- Extract the candidate's name (use "Candidate" if not present) and the role title.
- Identify 2-3 concrete, specific gaps between the resume and the JD that an interviewer should press on (missing skills, seniority, domain, scale). Be specific, not generic.
- Pick 4-5 question themes from: ${THEMES.join(", ")}.
- Estimate a realistic salary band for this role and the location implied by the JD. Default to Germany, EUR, annual gross if the location is unclear. openingOffer is HR's lowball at about 85% of the market median; ceiling is the hidden true maximum at about 110% of the median. Round to sensible thousands. marketNote is one sentence.
Return only the tool call.`;

interface Body {
  resume?: unknown;
  jd?: unknown;
  persona?: unknown;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { resume, jd, persona } = body;
  if (typeof resume !== "string" || !resume.trim() || typeof jd !== "string" || !jd.trim()) {
    return NextResponse.json({ error: "Missing required fields: resume, jd" }, { status: 400 });
  }

  const user = [
    typeof persona === "string" && persona ? `Interviewer persona: ${persona}\n` : "",
    `<resume>\n${resume}\n</resume>`,
    `<job_description>\n${jd}\n</job_description>`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const result = await structured<SetupResult>({
      system: SYSTEM,
      user,
      toolName: "setup_interview",
      description: "Record the interview setup: candidate, role, gaps, themes and salary band.",
      schema: SETUP_SCHEMA,
      maxTokens: 1500,
    });
    return NextResponse.json(normalizeSetup(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Guarantee the SetupResult shape regardless of how Claude filled the tool call. */
/** DEMO: fixed negotiation numbers so the offer call follows the rehearsed script. */
const DEMO_SALARY = { currency: "EUR", openingOffer: 52000, ceiling: 58000 };

function normalizeSetup(r: Partial<SetupResult> & { salary?: Partial<SetupResult["salary"]> }): SetupResult {
  const num = (v: unknown, d: number) => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : d;
  };
  return {
    candidateName: typeof r.candidateName === "string" && r.candidateName.trim() ? r.candidateName.trim() : "Candidate",
    roleTitle: typeof r.roleTitle === "string" && r.roleTitle.trim() ? r.roleTitle.trim() : "the role",
    gaps: Array.isArray(r.gaps) ? r.gaps.map(String).slice(0, 3) : [],
    themes: Array.isArray(r.themes) && r.themes.length ? r.themes.map(String) : ["behavioral", "technical", "leadership", "weakness"],
    salary: {
      ...DEMO_SALARY,
      marketNote: typeof r.salary?.marketNote === "string" ? r.salary.marketNote : "",
    },
  };
}
