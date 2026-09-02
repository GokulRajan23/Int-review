import type { TranscriptLine, AnswerJudgment } from "@/lib/types";
import { pairTranscript, answerMetrics, aggregate, patternsByTheme } from "@/lib/metrics";

const transcript: TranscriptLine[] = [
  { role: "agent", message: "Tell me about a time you led a project." },
  { role: "user", message: "So yeah, um, I think I led a migration last year." },
  { role: "user", message: "Basically we moved, like, twelve services to Kubernetes and cut costs 30%." },
  { role: "agent", message: "How did you handle" },
  { role: "agent", message: "conflict on that team?" },
  { role: "user", message: "So yeah, I guess there was a disagreement about, like, the rollout order. I mean, I set up a doc, we voted, and honestly it worked out." },
  { role: "agent", message: "What's your biggest weakness?" },
  { role: "user", message: "Um, uh, I'm not sure. Maybe I kind of over-plan things, you know? Actually probably that, right?" },
  { role: "agent", message: "Describe a hard technical bug." },
  { role: "user", message: "So yeah, we had a memory leak in a Node service that only showed up under load after roughly six hours in production. I added heap snapshots to the deploy pipeline, diffed them across intervals, and traced it to an event listener registered per request that was never removed. The fix was a two-line change but the tooling I built stayed and caught two more regressions in the following quarter, which the team still uses today." },
  { role: "agent", message: "Any questions for me?" },
];

const pairs = pairTranscript(transcript);
const metrics = answerMetrics(pairs);
const agg = aggregate(metrics);

const judgments: AnswerJudgment[] = [
  { index: 0, theme: "leadership", star: { situation: true, task: true, action: true, result: true }, confidence: 70, wordsBeforePoint: 5, note: "" },
  { index: 1, theme: "conflict", star: { situation: true, task: false, action: true, result: true }, confidence: 55, wordsBeforePoint: 6, note: "" },
  { index: 2, theme: "weakness", star: { situation: false, task: false, action: false, result: false }, confidence: 30, wordsBeforePoint: 4, note: "" },
  { index: 3, theme: "technical", star: { situation: true, task: true, action: true, result: true }, confidence: 85, wordsBeforePoint: 2, note: "" },
];

console.log(JSON.stringify({ pairs, metrics, aggregate: agg, patterns: patternsByTheme(metrics, judgments) }, null, 2));
