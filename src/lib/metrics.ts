// Deterministic answer metrics computed in code (no LLM).
import type {
  TranscriptLine,
  QAPair,
  AnswerMetrics,
  AggregateMetrics,
  AnswerJudgment,
} from "@/lib/types";

/**
 * Pair agent questions with the user answers that follow them.
 * Consecutive lines with the same role are joined. Trailing questions
 * with no answer are dropped. index starts at 0.
 */
export function pairTranscript(transcript: TranscriptLine[]): QAPair[] {
  const pairs: QAPair[] = [];
  let question: string[] = [];
  let answer: string[] = [];

  const flush = () => {
    if (question.length && answer.length) {
      pairs.push({
        index: pairs.length,
        question: question.join(" ").trim(),
        answer: answer.join(" ").trim(),
      });
    }
    question = [];
    answer = [];
  };

  for (const line of transcript) {
    const msg = line.message.trim();
    if (!msg) continue;
    if (line.role === "agent") {
      // A new agent line after an answer closes the previous pair.
      if (answer.length) flush();
      question.push(msg);
    } else {
      // User lines before any question are ignored.
      if (!question.length) continue;
      answer.push(msg);
    }
  }
  flush();
  return pairs;
}

/**
 * Filler patterns. "like" is only counted when it looks like a verbal tic:
 * "like," / ", like" / "like like" — a plain "like" (e.g. "I like this") is
 * not counted because distinguishing filler from verb/comparison without
 * POS tagging is unreliable. Multi-word fillers are matched as phrases.
 */
const FILLER_PATTERNS: { key: string; re: RegExp }[] = [
  { key: "um", re: /\bum+\b/gi },
  { key: "uh", re: /\buh+\b/gi },
  { key: "like", re: /(?:\blike\s*,|,\s*like\b|\blike\s+like\b)/gi },
  { key: "you know", re: /\byou know\b/gi },
  { key: "basically", re: /\bbasically\b/gi },
  { key: "so yeah", re: /\bso yeah\b/gi },
  { key: "kind of", re: /\bkind of\b/gi },
  { key: "sort of", re: /\bsort of\b/gi },
  { key: "actually", re: /\bactually\b/gi },
  { key: "right?", re: /\bright\?/gi },
];

const HEDGE_PHRASES = [
  "i think",
  "i guess",
  "maybe",
  "i'm not sure",
  "i'm not totally sure",
  "probably",
  "i believe",
  "sort of",
  "kind of",
  "i feel like",
  "hopefully",
  "i suppose",
  "to be honest",
  "i mean",
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const HEDGE_PATTERNS = HEDGE_PHRASES.map((phrase) => ({
  phrase,
  // Allow straight or curly apostrophes.
  re: new RegExp(`\\b${escapeRe(phrase).replace(/'/g, "['’]")}\\b`, "gi"),
}));

function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  return (text.match(re) ?? []).length;
}

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function answerMetrics(pairs: QAPair[]): AnswerMetrics[] {
  const counts = pairs.map((p) => words(p.answer).length);
  const med = median(counts);
  const canFlagOutliers = pairs.length >= 3;

  return pairs.map((pair, i) => {
    const text = pair.answer;
    const wordCount = counts[i];

    const fillers: Record<string, number> = {};
    let fillerTotal = 0;
    for (const { key, re } of FILLER_PATTERNS) {
      const n = countMatches(text, re);
      if (n > 0) {
        fillers[key] = n;
        fillerTotal += n;
      }
    }

    const hedges: string[] = [];
    for (const { phrase, re } of HEDGE_PATTERNS) {
      const n = countMatches(text, re);
      for (let k = 0; k < n; k++) hedges.push(phrase);
    }

    const sentenceStarter = words(text)
      .slice(0, 3)
      .map((w) => w.toLowerCase().replace(/[^\w']/g, ""))
      .filter(Boolean)
      .join(" ");

    return {
      index: pair.index,
      wordCount,
      fillers,
      fillerTotal,
      hedges,
      hedgeTotal: hedges.length,
      sentenceStarter,
      isLengthOutlier: canFlagOutliers && wordCount > 2 * med,
    };
  });
}

export function aggregate(metrics: AnswerMetrics[]): AggregateMetrics {
  const totalWords = metrics.reduce((s, m) => s + m.wordCount, 0);
  const totalFillers = metrics.reduce((s, m) => s + m.fillerTotal, 0);

  const starterCounts = new Map<string, number>();
  for (const m of metrics) {
    if (!m.sentenceStarter) continue;
    // Compare on the first 2 words so "so yeah um" and "so yeah i" count as the same habit.
    const key = m.sentenceStarter.split(" ").slice(0, 2).join(" ");
    starterCounts.set(key, (starterCounts.get(key) ?? 0) + 1);
  }
  const repeatedStarters = [...starterCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([starter, count]) => ({ starter, count }))
    .sort((a, b) => b.count - a.count || a.starter.localeCompare(b.starter));

  return {
    medianWordCount: median(metrics.map((m) => m.wordCount)),
    totalFillers,
    fillersPerHundredWords: totalWords ? round1((totalFillers / totalWords) * 100) : 0,
    repeatedStarters,
    outlierIndices: metrics.filter((m) => m.isLengthOutlier).map((m) => m.index),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function patternsByTheme(
  metrics: AnswerMetrics[],
  judgments: AnswerJudgment[],
): {
  fillersByTheme: Record<string, number>;
  hedgesByTheme: Record<string, number>;
  starCoverage: number;
  weakestTheme: string;
} {
  const byIndex = new Map(metrics.map((m) => [m.index, m]));
  const themes = new Map<
    string,
    { words: number; fillers: number; hedges: number; confidence: number; n: number }
  >();

  let starHits = 0;
  for (const j of judgments) {
    const m = byIndex.get(j.index);
    if (!m) continue;
    const starCount = Object.values(j.star).filter(Boolean).length;
    if (starCount >= 3) starHits++;

    const t = themes.get(j.theme) ?? { words: 0, fillers: 0, hedges: 0, confidence: 0, n: 0 };
    t.words += m.wordCount;
    t.fillers += m.fillerTotal;
    t.hedges += m.hedgeTotal;
    t.confidence += j.confidence;
    t.n += 1;
    themes.set(j.theme, t);
  }

  const fillersByTheme: Record<string, number> = {};
  const hedgesByTheme: Record<string, number> = {};
  let weakestTheme = "";
  let weakest: { avgConf: number; hedges: number } | null = null;

  for (const [theme, t] of themes) {
    fillersByTheme[theme] = t.words ? round1((t.fillers / t.words) * 100) : 0;
    hedgesByTheme[theme] = t.words ? round1((t.hedges / t.words) * 100) : 0;
    const avgConf = t.confidence / t.n;
    if (
      !weakest ||
      avgConf < weakest.avgConf ||
      (avgConf === weakest.avgConf && t.hedges > weakest.hedges)
    ) {
      weakest = { avgConf, hedges: t.hedges };
      weakestTheme = theme;
    }
  }

  return {
    fillersByTheme,
    hedgesByTheme,
    starCoverage: judgments.length ? round1(starHits / judgments.length * 100) / 100 : 0,
    weakestTheme,
  };
}
