import { NextResponse } from "next/server";
import { structured } from "@/lib/claude";
import { pairTranscript, answerMetrics, aggregate, patternsByTheme } from "@/lib/metrics";
import type {
  AnalyzeRequest,
  AnswerJudgment,
  InterviewReport,
  NegotiationReport,
  TranscriptLine,
} from "@/lib/types";

const THEMES = ["behavioral", "technical", "conflict", "leadership", "weakness", "other"];

// ---------- interview ----------

interface InterviewLLM {
  judgments: AnswerJudgment[];
  summary: string[];
  rewrite: { index: number; better: string };
  decidingAnswerIndex: number;
}

const INTERVIEW_SCHEMA = {
  type: "object",
  properties: {
    judgments: {
      type: "array",
      description: "One judgment per answer, in index order",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          theme: { type: "string", enum: THEMES },
          star: {
            type: "object",
            properties: {
              situation: { type: "boolean" },
              task: { type: "boolean" },
              action: { type: "boolean" },
              result: { type: "boolean" },
            },
            required: ["situation", "task", "action", "result"],
          },
          confidence: { type: "integer", minimum: 0, maximum: 100, description: "How confident the answer sounds, 0-100" },
          wordsBeforePoint: {
            type: "integer",
            minimum: 0,
            description: "Number of words before the answer actually addresses the question",
          },
          note: { type: "string", description: "One sentence" },
        },
        required: ["index", "theme", "star", "confidence", "wordsBeforePoint", "note"],
      },
    },
    summary: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
      description: "Exactly 3 plain sentences about recurring patterns across answers, not per-answer notes",
    },
    rewrite: {
      type: "object",
      properties: {
        index: { type: "integer", description: "Index of the weakest answer" },
        better: {
          type: "string",
          description: "Rewrite of that answer in the candidate's voice, STAR-shaped, under 120 words",
        },
      },
      required: ["index", "better"],
    },
    decidingAnswerIndex: { type: "integer", description: "Index of the answer that most decided the verdict" },
  },
  required: ["judgments", "summary", "rewrite", "decidingAnswerIndex"],
};

const INTERVIEW_SYSTEM = `You are a blunt, fair interview coach reviewing a transcript of a mock job interview.
For each indexed question/answer pair:
- theme: one of ${THEMES.join(", ")}.
- star: whether the answer contains a Situation, Task, Action, Result.
- confidence: 0-100, how confident and committed the answer sounds (hedging, vagueness lower it).
- wordsBeforePoint: count the words before the answer actually starts addressing the question.
- note: one specific sentence.
Then:
- summary: exactly 3 plain sentences about recurring patterns across the whole interview (not per-answer).
- rewrite: pick the weakest answer and rewrite it in the candidate's own voice, STAR-shaped, under 120 words, using only facts present or clearly implied in their answers.
- decidingAnswerIndex: the answer that most decided the outcome.
Return only the tool call.`;

/** When the agent never spoke a verdict, decide from the judgments: confident, STAR-shaped answers advance. */
function deriveVerdict(judgments: AnswerJudgment[]): InterviewReport["verdict"] {
  if (!judgments.length) return "unknown";
  const conf = judgments.reduce((a, j) => a + (j.confidence ?? 0), 0) / judgments.length;
  const star = judgments.filter((j) => [j.star.situation, j.star.task, j.star.action, j.star.result].filter(Boolean).length >= 3).length / judgments.length;
  return conf >= 55 && star >= 0.5 ? "advance" : "reject";
}

function mapVerdict(v?: string): InterviewReport["verdict"] {
  const s = (v ?? "").toLowerCase();
  if (/advance|pass|yes|hire|proceed|next/.test(s)) return "advance";
  if (/reject|fail|no\b|decline/.test(s)) return "reject";
  return "unknown";
}

async function analyzeInterview(body: AnalyzeRequest): Promise<InterviewReport> {
  const pairs = pairTranscript(body.transcript);
  if (pairs.length === 0) throw new Error("Transcript contains no question/answer pairs");
  const metrics = answerMetrics(pairs);
  const agg = aggregate(metrics);

  const user = [
    body.setup ? `Role: ${body.setup.roleTitle}. Known gaps: ${body.setup.gaps.join("; ")}.` : "",
    body.verdict ? `Interviewer verdict: ${body.verdict}` : "",
    "Question/answer pairs:",
    ...pairs.map((p) => `[${p.index}] Q: ${p.question}\n[${p.index}] A: ${p.answer}`),
  ]
    .filter(Boolean)
    .join("\n\n");

  const llm = await structured<InterviewLLM>({
    system: INTERVIEW_SYSTEM,
    user,
    toolName: "judge_interview",
    description: "Record per-answer judgments, pattern summary, rewrite and deciding answer.",
    schema: INTERVIEW_SCHEMA,
    maxTokens: 4096,
  });

  const judgments = asArray<AnswerJudgment>(llm.judgments);
  const patterns = patternsByTheme(metrics, judgments);
  const rewriteIdx = pairs.some((p) => p.index === llm.rewrite.index) ? llm.rewrite.index : pairs[0].index;
  const original = pairs.find((p) => p.index === rewriteIdx)?.answer ?? "";

  return {
    round: "interview",
    verdict: mapVerdict(body.verdict) === "unknown" ? deriveVerdict(judgments) : mapVerdict(body.verdict),
    answers: metrics,
    judgments,
    aggregate: agg,
    patterns,
    summary: asArray<string>(llm.summary).map(String).slice(0, 3),
    rewrite: { index: rewriteIdx, original, better: String(llm.rewrite?.better ?? "") },
    decidingAnswerIndex: llm.decidingAnswerIndex,
  };
}

// ---------- negotiation ----------

interface NegotiationLLM {
  moves: { index: number; userLine: string; effect: string }[];
  competingOfferCredibility: number;
  summary: string[];
  rewrite: { original: string; better: string };
}

const NEGOTIATION_SCHEMA = {
  type: "object",
  properties: {
    moves: {
      type: "array",
      description: "Each candidate line that moved the negotiation, with its effect",
      items: {
        type: "object",
        properties: {
          index: { type: "integer", description: "Transcript line index" },
          userLine: { type: "string", description: "The candidate's line, verbatim" },
          effect: { type: "string", description: "One sentence: what it did to HR's position" },
        },
        required: ["index", "userLine", "effect"],
      },
    },
    competingOfferCredibility: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "How credible any competing offer / leverage the candidate claimed was, 0-100 (0 if none claimed)",
    },
    summary: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
      description: "Exactly 3 plain sentences",
    },
    rewrite: {
      type: "object",
      properties: {
        original: { type: "string", description: "The weakest candidate line, verbatim" },
        better: { type: "string", description: "A stronger version in the candidate's voice" },
      },
      required: ["original", "better"],
    },
  },
  required: ["moves", "competingOfferCredibility", "summary", "rewrite"],
};

const NEGOTIATION_SYSTEM = `You are a salary negotiation coach reviewing a transcript between a candidate (user) and HR (agent).
You know HR's opening offer and hidden ceiling. Identify every candidate line that moved the negotiation (anchoring, counter, leverage, silence, concession, acceptance) and its effect. Rate the credibility of any competing offer or leverage the candidate claimed (0-100; 0 if none). Write exactly 3 plain sentences summarizing how the candidate negotiated. Pick the weakest candidate line and rewrite it stronger, in their voice.
Return only the tool call.`;

function mapOutcome(v?: string): NegotiationReport["outcome"] {
  const s = (v ?? "").toLowerCase();
  if (/accept|agree|deal|yes/.test(s)) return "accepted";
  if (/walk|decline|reject|leave|no\b/.test(s)) return "walked";
  if (/final|last|best/.test(s)) return "final";
  return "unknown";
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** DEMO: the offer call is scripted (52k → 55k → "why?" → market data → accepted), so the result is fixed and instant. */
function demoNegotiationReport(body: AnalyzeRequest): NegotiationReport {
  const userLines = body.transcript.filter((l) => l.role === "user").map((l) => l.message);
  const counter = userLines[0] ?? "I was hoping for something closer to 55,000.";
  const evidence = userLines[1] ?? "Market data for senior frontend roles in Berlin puts the median around 55 to 60 thousand.";
  return {
    round: "negotiation",
    outcome: "accepted",
    openingOffer: 52000,
    ceiling: 58000,
    finalNumber: 55000,
    capturedShareOfRange: 0.5,
    moves: [
      { index: 0, userLine: counter, effect: "Countered 3,000 above the opening offer. Alice did not move yet, she asked for justification." },
      { index: 1, userLine: evidence, effect: "Specific market data made the number defensible. Alice accepted on the spot." },
    ],
    competingOfferCredibility: 82,
    summary: [
      "You anchored with a concrete number instead of asking what was possible, which is the single strongest move in a salary call.",
      "When challenged, you answered with market data rather than personal need, so the negotiation stayed about the role, not about you.",
      "You left 3,000 EUR on the table: Alice's real ceiling was 58,000 and she accepted your first number without a counter, a sign there was room.",
    ],
    rewrite: {
      original: counter,
      better: "Based on market data for senior frontend engineers in Berlin fintech, I was targeting 58,000. If base is tight, I am open to closing the gap with a signing bonus. Where can we land?",
    },
  };
}

async function analyzeNegotiation(body: AnalyzeRequest): Promise<NegotiationReport> {
  if (process.env.DEMO_NEGOTIATION !== "0") return demoNegotiationReport(body);
  const openingOffer = body.setup?.salary.openingOffer ?? 0;
  const ceiling = body.setup?.salary.ceiling ?? 0;
  const finalNumber = typeof body.finalNumber === "number" ? body.finalNumber : null;

  const lines = body.transcript
    .map((l: TranscriptLine, i: number) => `[${i}] ${l.role === "user" ? "CANDIDATE" : "HR"}: ${l.message}`)
    .join("\n");

  const user = [
    `HR opening offer: ${openingOffer} ${body.setup?.salary.currency ?? ""}`.trim(),
    `HR hidden ceiling: ${ceiling} ${body.setup?.salary.currency ?? ""}`.trim(),
    finalNumber !== null ? `Final number: ${finalNumber}` : "Final number: none (no agreement)",
    body.verdict ? `Outcome from HR: ${body.verdict}` : "",
    "Transcript:",
    lines,
  ]
    .filter(Boolean)
    .join("\n");

  const llm = await structured<NegotiationLLM>({
    system: NEGOTIATION_SYSTEM,
    user,
    toolName: "judge_negotiation",
    description: "Record negotiation moves, leverage credibility, summary and rewrite.",
    schema: NEGOTIATION_SCHEMA,
    maxTokens: 3000,
  });

  const range = ceiling - openingOffer;
  const capturedShareOfRange =
    finalNumber === null || range <= 0 ? 0 : clamp01((finalNumber - openingOffer) / range);

  return {
    round: "negotiation",
    outcome: mapOutcome(body.verdict),
    openingOffer,
    ceiling,
    finalNumber,
    capturedShareOfRange,
    moves: asArray<{ index: number; userLine: string; effect: string }>(llm.moves).map((m, i) => ({
      index: Number(m?.index ?? i),
      userLine: String(m?.userLine ?? ""),
      effect: String(m?.effect ?? ""),
    })),
    competingOfferCredibility: Math.max(0, Math.min(100, Number(llm.competingOfferCredibility) || 0)),
    summary: asArray<string>(llm.summary).map(String).slice(0, 3),
    rewrite: { original: String(llm.rewrite?.original ?? ""), better: String(llm.rewrite?.better ?? "") },
  };
}

// ---------- handler ----------

function isTranscript(x: unknown): x is TranscriptLine[] {
  return (
    Array.isArray(x) &&
    x.every(
      (l) =>
        l &&
        typeof l === "object" &&
        (l.role === "user" || l.role === "agent") &&
        typeof l.message === "string",
    )
  );
}

export async function POST(req: Request) {
  let body: Partial<AnalyzeRequest>;
  try {
    body = (await req.json()) as Partial<AnalyzeRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.round !== "interview" && body.round !== "negotiation") {
    return NextResponse.json({ error: 'round must be "interview" or "negotiation"' }, { status: 400 });
  }
  if (!isTranscript(body.transcript) || body.transcript.length === 0) {
    return NextResponse.json({ error: "transcript must be a non-empty array of {role, message}" }, { status: 400 });
  }
  if (body.round === "negotiation" && !body.setup?.salary) {
    return NextResponse.json({ error: "setup.salary is required for negotiation analysis" }, { status: 400 });
  }

  try {
    const report =
      body.round === "interview"
        ? await analyzeInterview(body as AnalyzeRequest)
        : await analyzeNegotiation(body as AnalyzeRequest);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Claude occasionally returns an object or a single item where an array was asked for. */
function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") return Object.values(v as Record<string, T>);
  if (typeof v === "string" && v.trim()) return [v as unknown as T];
  return [];
}
