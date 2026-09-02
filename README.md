# int_review

Find your weak spots before they do.

You paste a resume and a job description. A persona interviews you by voice, asks three questions, and gives a verdict. If you pass, an HR persona calls with an offer and you negotiate. After each round you get a debrief: filler words, hedging, STAR structure, the answer that decided the verdict, and a rewrite of your weakest answer. The negotiation debrief reveals the ceiling HR never told you and how much of the range you captured.

## Personas

| Persona | Role | Voice | Hidden state |
|---|---|---|---|
| Chris | Founder, relaxed technical interviewer | Chris (ElevenLabs) | impression score 0-100 |
| Daniel | Skeptical staff engineer, commander tone | Brock (ElevenLabs library) | impression score 0-100 |
| Alice | HR negotiator | Alice (ElevenLabs) | salary ceiling, patience, credibility of your leverage |

The persona speaks the verdict aloud. "We will get back to you." means rejected. "Congratulations! You are selected for the next round!" means advanced.

## How it works

- The voice loop runs on ElevenLabs Conversational AI. Two agents, Interviewer and HR Negotiator, are hosted on ElevenLabs with Gemini 2.5 Flash as the in-call model. The browser connects over WebRTC through the ElevenLabs React SDK. Resume, job description, persona brief, and salary numbers are injected per session as dynamic variables.
- Claude Sonnet 5 does the judgment. One call before the interview reads the resume against the job description and finds the gaps the interviewer will press on. One call after each round turns the transcript into the debrief.
- Deterministic metrics run in code, not in a model: filler counts, hedge phrases, repeated sentence starters, answer length outliers.
- The round always ends after three answers. The app tells the agent to close, treats the next line as the verdict, waits for the persona to finish speaking, then ends the call. If the agent never speaks a clear verdict, the debrief derives one from confidence and STAR coverage.

## Stack

Next.js 16 App Router, TypeScript, Tailwind v4, `@elevenlabs/react`, `@anthropic-ai/sdk`.

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create `.env.local` from `.env.example`.

```
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_INTERVIEWER=
ELEVENLABS_AGENT_HR=
```

3. Create the two ElevenLabs agents. The script reads the prompts from `agents/` and writes the agent IDs into `.env.local`.

```bash
export $(grep -v '^#' .env.local | xargs)
npx tsx scripts/create-agents.ts
```

The prompts, client tool definitions, and dashboard settings are documented in `agents/interviewer.md` and `agents/hr-negotiator.md` if you prefer to create the agents by hand.

4. Run.

```bash
npm run dev
```

Open http://localhost:3000 in Chrome and allow the microphone.

## Demo mode

The offer call is scripted for presentation. The setup route fixes the salary band at 52,000 opening and 58,000 ceiling in EUR. Alice asks why when you counter, accepts when you cite market data, and the negotiation debrief is returned instantly from a fixed result. Set `DEMO_NEGOTIATION=0` to restore the Claude analysis of the real transcript. The salary band constant is in `src/app/api/setup/route.ts`.

## Project structure

```
agents/                       ElevenLabs agent prompts, tools, and setup notes
scripts/create-agents.ts      Creates both agents via the ElevenLabs API
scripts/analyze-smoke.ts      Posts a sample transcript to /api/analyze
src/app/api/setup             Resume vs job description gap analysis and salary band
src/app/api/session           Agent ID, voice override, and dynamic variables per call
src/app/api/analyze           Debrief generation for both rounds
src/lib/metrics.ts            Deterministic transcript metrics
src/lib/personas.ts           Persona briefs, voices, first messages
src/components/CallStage.tsx  Live call: mascot, transcript, round cap, close-out
src/components/ReportView.tsx Debrief rendering
src/components/mascot/        SVG mascots with speaking and listening states
```

## Known limits

- The in-call model decides the verdict inside the ElevenLabs agent. The debrief explains it afterwards but does not make the call.
- Interruptions cannot be disabled server side on the WebRTC transport. Loud room noise while a persona speaks can cut a sentence short.
- Filler word counts depend on the speech recognizer keeping disfluencies in the transcript.
