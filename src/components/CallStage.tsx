"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import type { Persona, Round, TranscriptLine } from "@/lib/types";
import type { SessionResponse } from "@/app/api/session/route";
import { PersonaMascot, PERSONA_META, type MascotState } from "@/components/mascot";

export interface EndPayload { verdict?: string; outcome?: string; final_number?: number; reason?: string; impression?: number }

interface Props {
  persona: Persona;
  round: Round;
  session: SessionResponse;
  onEnd: (transcript: TranscriptLine[], payload: EndPayload) => void;
}

export function CallStage(props: Props) {
  return (
    <ConversationProvider>
      <Stage {...props} />
    </ConversationProvider>
  );
}

function Stage({ persona, round, session, onEnd }: Props) {
  const meta = PERSONA_META[persona];
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const linesRef = useRef<TranscriptLine[]>([]);
  const endedRef = useRef(false);
  const t0 = useRef(Date.now());
  const [error, setError] = useState<string | null>(null);
  const MAX_Q = 3;
  const stopSentRef = useRef(0);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verdictFromAgentLines = (since: number) => {
    const txt = linesRef.current.slice(since).filter((l) => l.role === "agent").map((l) => l.message).join(" ").toLowerCase();
    return /congratulations|selected for the next round/.test(txt) ? "advance" : /get back to you/.test(txt) ? "reject" : "unknown";
  };
  const lastAnswerIdx = useRef(0);
  /** Negotiation close-out: last salary-like number Alice said, else the opening offer. */
  const negotiationPayload = (since: number, reason: string): EndPayload => {
    const agentTxt = linesRef.current.slice(since).filter((l) => l.role === "agent").map((l) => l.message).join(" ");
    const userTxt = linesRef.current.slice(since).filter((l) => l.role === "user").map((l) => l.message).join(" ").toLowerCase();
    const nums = [...agentTxt.matchAll(/(\d{2,3})[.,]?(\d{3})\b|(\d{2,3})\s?k\b/gi)].map((m) => (m[3] ? Number(m[3]) * 1000 : Number(`${m[1]}${m[2]}`))).filter((n) => n >= 10000);
    const opening = Number(session.dynamicVariables.opening_offer) || 0;
    const final_number = nums.length ? nums[nums.length - 1] : opening;
    const outcome = /\b(accept|deal|i'll take|i will take|sounds good|agreed)\b/.test(userTxt) ? "accepted" : /\b(decline|walk|no thanks|not interested|withdraw)\b/.test(userTxt) ? "walked" : "final";
    return { outcome, final_number, reason };
  };
  const closePayload = (since: number, reason: string): EndPayload =>
    round === "interview" ? { verdict: verdictFromAgentLines(since), reason } : negotiationPayload(0, reason);

  /** Number of agent→user exchanges so far (an answer following a question). */
  const answeredCount = (ls: TranscriptLine[]) => {
    let n = 0;
    for (let i = 1; i < ls.length; i++) if (ls[i].role === "user" && ls[i - 1].role === "agent") n++;
    return n;
  };

  const conv = useConversation({
    onMessage: (m) => {
      const role = (m.role ?? (m.source === "ai" ? "agent" : "user")) as "user" | "agent";
      const line = { role, message: m.message, t: Date.now() - t0.current };
      linesRef.current = [...linesRef.current, line];
      setLines(linesRef.current);
      if (endedRef.current) return;

      const answered = answeredCount(linesRef.current);
      // After the last allowed answer: tell the agent to wrap up, and arm a hard stop so the round
      // ends no matter what the model does.
      if (role === "user" && answered >= MAX_Q && stopSentRef.current < answered) {
        stopSentRef.current = answered;
        lastAnswerIdx.current = linesRef.current.length;
        try {
          conv.sendContextualUpdate(
            round === "interview"
              ? `SYSTEM NOTE: The candidate has answered all ${MAX_Q} questions. Do not ask another question. Thank them in one sentence, speak the verdict, and call end_round now.`
              : `SYSTEM NOTE: The three exchanges are over. Close now: state your final number in one sentence and call end_negotiation.`,
          );
        } catch {}
        if (!hardTimer.current) {
          hardTimer.current = setTimeout(() => finish(closePayload(lastAnswerIdx.current, "Round closed after the final exchange.")), 20000);
        }
      }
      // Negotiation: Alice accepting closes the call, however early.
      if (round === "negotiation" && role === "agent" && !fallbackTimer.current && /welcome aboard|we have a deal|\d[\d,.]*\s*(k|thousand|eur|euros)?\s*it is|i can do that|let's do it|agreed/i.test(m.message)) {
        fallbackTimer.current = setTimeout(() => finish({ ...negotiationPayload(0, m.message), outcome: "accepted", final_number: 55000 }), 6000);
      }
      // The agent's next line after the final answer is the verdict: let it finish speaking, then end.
      if (role === "agent" && stopSentRef.current >= MAX_Q && !fallbackTimer.current) {
        fallbackTimer.current = setTimeout(() => finish(closePayload(lastAnswerIdx.current, m.message)), 7000);
      }
    },
    onError: (e) => setError(String(e)),
    onDisconnect: () => {
      if (endedRef.current || linesRef.current.length < 2) return;
      endedRef.current = true;
      onEnd(linesRef.current, closePayload(0, "Call ended early."));
    },
  });

  const finish = (payload: EndPayload) => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    if (hardTimer.current) clearTimeout(hardTimer.current);
    setTimeout(() => { try { conv.endSession(); } catch {} onEnd(linesRef.current, payload); }, 1800);
  };

  const start = () => {
    setError(null);
    // WebRTC is the low-latency path; agents are public so agentId is enough.
    conv.startSession({
      agentId: session.agentId,
      connectionType: "webrtc",
      overrides: session.overrides,
      dynamicVariables: session.dynamicVariables,
      clientTools: {
        end_round: (p: Record<string, unknown>) => { finish(p as EndPayload); return "ok"; },
        end_negotiation: (p: Record<string, unknown>) => { finish(p as EndPayload); return "ok"; },
      },
    } as Parameters<typeof conv.startSession>[0]);
  };

  const state: MascotState = useMemo(() => {
    if (conv.status === "connecting") return "thinking";
    if (conv.status !== "connected") return "idle";
    return conv.isSpeaking ? "speaking" : "listening";
  }, [conv.status, conv.isSpeaking]);

  // Mute the mic while the persona speaks so room noise cannot interrupt them; reopen shortly after.
  useEffect(() => {
    if (conv.status !== "connected") return;
    if (conv.isSpeaking) { conv.setMuted(true); return; }
    const t = setTimeout(() => conv.setMuted(false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.isSpeaking, conv.status]);

  const questionCount = Math.min(lines.filter((l) => l.role === "agent").length, 3);
  const live = conv.status === "connected";
  const recent = lines.slice(-8);
  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => { transcriptRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [lines.length]);

  return (
    <div className="relative grid w-full grid-cols-1 gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
      {/* left panel: transcript */}
      <div className="glass order-2 h-72 overflow-hidden p-4 lg:order-1 lg:-rotate-y-6">
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-white/50">
          <span>Live transcript</span><span>{lines.length} lines</span>
        </div>
        <div ref={transcriptRef} className="h-56 space-y-2 overflow-y-auto pr-1 text-sm">
          {recent.length === 0 && <p className="text-white/30">Waiting for {meta.name} to speak.</p>}
          {recent.map((l, i) => (
            <p key={i} className={l.role === "agent" ? "text-white/85" : "text-[var(--accent)]"}>
              <span className="mr-2 text-[10px] uppercase tracking-wider opacity-50">{l.role === "agent" ? meta.name : "You"}</span>{l.message}
            </p>
          ))}
        </div>
      </div>

      {/* center: mascot */}
      <div className="order-1 flex flex-col items-center gap-4 lg:order-2">
        <PersonaMascot persona={persona} state={state} size={300} />
        <div className="text-center">
          <div className="text-2xl font-semibold">{meta.name}</div>
          <div className="text-sm text-white/50">{meta.title}</div>
        </div>
        {!live && !endedRef.current && (
          <button onClick={start} className="btn-accent mt-2" disabled={conv.status === "connecting"}>
            {conv.status === "connecting" ? "Connecting…" : round === "interview" ? "Join the interview" : "Take the call"}
          </button>
        )}
        {live && (
          <button onClick={() => { conv.endSession(); }} className="text-xs text-white/40 underline-offset-4 hover:underline">hang up</button>
        )}
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>

      {/* right panel: state */}
      <div className="glass order-3 space-y-4 p-4 lg:rotate-y-6">
        <div className="text-xs uppercase tracking-widest text-white/50">Room state</div>
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${live ? "bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" : "bg-white/20"}`} />
          <span className="text-sm">{conv.status === "connected" ? (conv.isSpeaking ? `${meta.name} is speaking` : "Listening to you") : conv.status}</span>
        </div>
        {round === "interview" ? (
          <div>
            <div className="mb-1 text-sm text-white/60">Questions</div>
            <div className="flex gap-1.5">{[1,2,3].map((n) => <span key={n} className={`h-2 flex-1 rounded-full ${n <= questionCount ? "bg-[var(--accent)]" : "bg-white/10"}`} />)}</div>
          </div>
        ) : (
          <div className="text-sm text-white/60">Opening offer on the table. Their ceiling is hidden.</div>
        )}
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="text-xs text-white/40">{round === "interview" ? "Impression score" : "Real ceiling"}</div>
          <div className="mt-1 font-mono text-lg tracking-widest text-white/70">🔒 hidden</div>
          <div className="text-[11px] text-white/35">revealed in the debrief</div>
        </div>
      </div>
    </div>
  );
}
