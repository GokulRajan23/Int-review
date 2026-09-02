/* Creates (or updates) the two ElevenLabs agents from agents/*.md and writes IDs to .env.local */
import fs from "node:fs";

const KEY = process.env.ELEVENLABS_API_KEY!;
if (!KEY) throw new Error("ELEVENLABS_API_KEY missing");
const API = "https://api.elevenlabs.io/v1/convai";

function block(md: string, heading: string): string {
  const i = md.indexOf(heading);
  const start = md.indexOf("```", i) + 3;
  const end = md.indexOf("```", start);
  return md.slice(start, end).trim();
}

const interviewerMd = fs.readFileSync("agents/interviewer.md", "utf8");
const hrMd = fs.readFileSync("agents/hr-negotiator.md", "utf8");

const endRound = {
  type: "client",
  name: "end_round",
  description:
    "Call this exactly once, immediately after you have spoken the verdict aloud following the fifth answer. Ends the interview round and reports the hidden result to the app.",
  expects_response: false,
  parameters: {
    type: "object",
    required: ["verdict", "reason", "impression"],
    properties: {
      verdict: { type: "string", enum: ["advance", "reject"], description: "advance if final impression >= 60, else reject." },
      reason: { type: "string", description: "One or two sentences naming the most decisive factor." },
      impression: { type: "number", description: "Final hidden impression score, integer 0-100." },
    },
  },
};
const noteAnswer = {
  type: "client",
  name: "note_answer",
  description: "Call silently after each of the five main answers with the question index and your private score adjustment. Never mention this to the candidate.",
  expects_response: false,
  parameters: {
    type: "object",
    required: ["index", "delta", "note"],
    properties: {
      index: { type: "number", description: "Main question index, 1 to 5." },
      delta: { type: "number", description: "Score change applied, -12 to 12." },
      note: { type: "string", description: "One sentence on why." },
    },
  },
};
const endNegotiation = {
  type: "client",
  name: "end_negotiation",
  description: "Call exactly once when the negotiation ends: the candidate accepts, walks away, or you deliver your final offer and they do not accept.",
  expects_response: false,
  parameters: {
    type: "object",
    required: ["outcome", "final_number", "reason"],
    properties: {
      outcome: { type: "string", enum: ["accepted", "walked", "final"], description: "accepted if the candidate agreed, walked if they declined, final if you made a final offer they did not accept." },
      final_number: { type: "number", description: "Last number on the table, annual gross." },
      reason: { type: "string", description: "One sentence on what decided it." },
    },
  },
};

const overrides = {
  conversation_config_override: {
    agent: { prompt: { prompt: true }, first_message: true, language: false },
    tts: { voice_id: true },
  },
};

function payload(name: string, prompt: string, firstMessage: string, voiceId: string, stability: number, tools: object[]) {
  return {
    name,
    conversation_config: {
      agent: {
        first_message: firstMessage,
        language: "en",
        dynamic_variables: { dynamic_variable_placeholders: {} },
        prompt: { prompt, llm: "claude-sonnet-5", temperature: 0.5, tools },
      },
      tts: { voice_id: voiceId, stability, similarity_boost: 0.8, model_id: "eleven_turbo_v2" },
      conversation: { max_duration_seconds: 900 },
      turn: { turn_timeout: 12 },
    },
    platform_settings: { overrides, auth: { enable_auth: false } },
  };
}

async function create(body: object): Promise<string> {
  const r = await fetch(`${API}/agents/create`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 2000));
  return j.agent_id;
}

async function main() {
  const existing = /^ELEVENLABS_AGENT_INTERVIEWER=(.+)$/m.exec(fs.readFileSync(".env.local","utf8"))?.[1]?.trim();
  const interviewer = existing || await create(
    payload(
      "Offer Room – Interviewer",
      block(interviewerMd, "## System prompt"),
      block(interviewerMd, "## First message"),
      "DGzg6RaUqxGRTHSBjfgF", // Daniel default (Commander Daniel / Brock); founder overrides to Chris
      0.6,
      [endRound, noteAnswer],
    ),
  );
  console.log("interviewer", interviewer);
  const hr = await create(
    payload(
      "Offer Room – HR Negotiator",
      block(hrMd, "## System prompt"),
      block(hrMd, "## First message"),
      "Xb7hH8MSUJpSbSDYk0k2", // Alice
      0.5,
      [endNegotiation],
    ),
  );
  console.log("hr", hr);

  let env = fs.readFileSync(".env.local", "utf8");
  env = env.replace(/^ELEVENLABS_AGENT_INTERVIEWER=.*$/m, `ELEVENLABS_AGENT_INTERVIEWER=${interviewer}`);
  env = env.replace(/^ELEVENLABS_AGENT_INTERVIEWER=.*$/m, `ELEVENLABS_AGENT_INTERVIEWER=${interviewer}`);
  env = env.replace(/^ELEVENLABS_AGENT_HR=.*$/m, `ELEVENLABS_AGENT_HR=${hr}`);
  fs.writeFileSync(".env.local", env);
  console.log(".env.local updated");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
