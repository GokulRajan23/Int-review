// Shared types for Offer Room backend. All agents import from here; do not redefine.

export type Persona = "founder" | "engineer" | "hr";
export type Round = "interview" | "negotiation";
export type Role = "user" | "agent";

export interface TranscriptLine {
  role: Role;
  message: string;
  /** ms since session start, optional (from client) */
  t?: number;
}

export interface PersonaConfig {
  id: Persona;
  name: string;
  title: string;
  voiceId: string;
  /** Which ElevenLabs agent env var this persona uses */
  agent: "interviewer" | "hr";
  /** Injected as dynamic variable {{persona_instructions}} */
  personaInstructions: string;
  firstMessage: string;
}

/** Output of POST /api/setup */
export interface SetupResult {
  candidateName: string;
  roleTitle: string;
  gaps: string[]; // 2-3 CV vs JD gaps to press on
  themes: string[]; // question themes to cover
  salary: {
    currency: string;
    openingOffer: number; // HR's first number
    ceiling: number; // hidden true max
    marketNote: string;
  };
}

/** One user answer paired with the question that preceded it */
export interface QAPair {
  index: number;
  question: string;
  answer: string;
}

/** Deterministic, computed in code */
export interface AnswerMetrics {
  index: number;
  wordCount: number;
  fillers: Record<string, number>; // "um": 3
  fillerTotal: number;
  hedges: string[]; // matched hedge phrases
  hedgeTotal: number;
  sentenceStarter: string; // first 3 words lowercased
  isLengthOutlier: boolean; // > 2x median wordCount
}

export interface AggregateMetrics {
  medianWordCount: number;
  totalFillers: number;
  fillersPerHundredWords: number;
  repeatedStarters: { starter: string; count: number }[];
  outlierIndices: number[];
}

/** Claude judgment per answer */
export interface AnswerJudgment {
  index: number;
  theme: string; // behavioral | technical | conflict | leadership | weakness | other
  star: { situation: boolean; task: boolean; action: boolean; result: boolean };
  confidence: number; // 0-100
  wordsBeforePoint: number;
  note: string; // one sentence
}

export interface InterviewReport {
  round: "interview";
  verdict: "advance" | "reject" | "unknown";
  answers: AnswerMetrics[];
  judgments: AnswerJudgment[];
  aggregate: AggregateMetrics;
  patterns: {
    fillersByTheme: Record<string, number>; // per 100 words
    hedgesByTheme: Record<string, number>;
    starCoverage: number; // 0-1 share of answers with >=3 STAR parts
    weakestTheme: string;
  };
  summary: string[]; // 3 plain sentences
  rewrite: { index: number; original: string; better: string };
  decidingAnswerIndex: number;
}

export interface NegotiationReport {
  round: "negotiation";
  outcome: "accepted" | "walked" | "final" | "unknown";
  openingOffer: number;
  ceiling: number;
  finalNumber: number | null;
  capturedShareOfRange: number; // 0-1
  moves: { index: number; userLine: string; effect: string }[];
  competingOfferCredibility: number; // 0-100
  summary: string[];
  rewrite: { original: string; better: string };
}

export type Report = InterviewReport | NegotiationReport;

/** Body of POST /api/analyze */
export interface AnalyzeRequest {
  round: Round;
  transcript: TranscriptLine[];
  setup?: SetupResult;
  verdict?: string; // from end_round / end_negotiation client tool
  finalNumber?: number;
}
