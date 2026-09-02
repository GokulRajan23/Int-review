/**
 * Smoke test for POST /api/analyze (interview round).
 * Run with the dev server up and ANTHROPIC_API_KEY set:
 *   npx tsx scripts/analyze-smoke.ts
 */
import type { AnalyzeRequest, Report } from "../src/lib/types";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const body: AnalyzeRequest = {
  round: "interview",
  verdict: "reject",
  setup: {
    candidateName: "Test Candidate",
    roleTitle: "Senior Backend Engineer",
    gaps: ["No Kubernetes in production", "Never led a team"],
    themes: ["behavioral", "technical", "conflict", "leadership"],
    salary: { currency: "EUR", openingOffer: 72000, ceiling: 93000, marketNote: "Berlin senior backend median ~85k." },
  },
  transcript: [
    { role: "agent", message: "Tell me about a time you had to deliver under a tight deadline.", t: 0 },
    {
      role: "user",
      message:
        "Um, so, yeah, I think there was this one time at my last company where we kind of had a release and, um, it was pretty tight, and I guess we just worked hard and shipped it. It went okay I think.",
      t: 4000,
    },
    { role: "agent", message: "How would you design a rate limiter for a public API?", t: 20000 },
    {
      role: "user",
      message:
        "I would use a token bucket per API key stored in Redis, with a Lua script to make the check-and-decrement atomic. Buckets refill at the plan's rate. Rejected requests return 429 with a Retry-After header, and I'd add a sliding window log for the top tier to smooth bursts.",
      t: 25000,
    },
    { role: "agent", message: "Describe a conflict with a colleague and how you resolved it.", t: 50000 },
    {
      role: "user",
      message:
        "So, um, a designer and I disagreed about, like, an API shape. I sort of just, you know, went with theirs to avoid friction. Maybe I should have pushed back more, I don't know.",
      t: 55000,
    },
    { role: "agent", message: "Have you ever led a team or mentored engineers?", t: 75000 },
    {
      role: "user",
      message:
        "I mentored two juniors during onboarding. I set up weekly pairing sessions and a checklist of first tasks; both were shipping independently within six weeks, and one later took over the service I had built.",
      t: 80000,
    },
  ],
};

async function main() {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Report | { error: string };
  console.log("status", res.status);
  console.log(JSON.stringify(json, null, 2));
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
