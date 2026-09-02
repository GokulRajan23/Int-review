# Offer Room: ElevenLabs agent setup (hackathon order)

1. Sign in to the ElevenLabs dashboard, open Conversational AI > Agents, and create two blank agents: `Offer Room Interviewer` and `Offer Room HR`.
2. For each agent set the LLM to Claude Sonnet, then paste the system prompt and first message from `interviewer.md` / `hr-negotiator.md`.
3. Add the dynamic variables listed in each file (with placeholder defaults) so the prompts save without errors.
4. Add the client tools: `end_round` on the interviewer, `end_negotiation` on the HR agent, with the exact parameter names and types from the docs.
5. Set the voices (Chris `iP95p4xoKVk53GoZ742B` on the interviewer, Alice `Xb7hH8MSUJpSbSDYk0k2` on HR) and the stability settings from the docs.
6. In each agent's Security tab enable overrides for system prompt, first message and voice; set max conversation duration to 600 s.
7. Make both agents public (simplest), or keep them private and rely on signed URLs via your API key.
8. Copy both agent ids into `.env.local`: `ELEVENLABS_AGENT_INTERVIEWER=...`, `ELEVENLABS_AGENT_HR=...`, plus `ELEVENLABS_API_KEY=...` (needed for signed URLs; optional if public) and `ANTHROPIC_API_KEY=...` for setup/analysis.
9. Run `npm run dev`, then `POST /api/session` with `{ persona, setup, resume, jd }` and confirm you get `agentId`, `overrides`, `dynamicVariables` (and `signedUrl` if the key is set).
10. Do one full voice test per persona in the app: five questions and a spoken verdict followed by `end_round`; a negotiation that ends with `end_negotiation`. Fix prompt wording in the dashboard, not in code.
