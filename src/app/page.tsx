"use client";
import { useEffect, useState } from "react";
import type { Persona, Report, SetupResult, TranscriptLine, InterviewReport, NegotiationReport } from "@/lib/types";
import type { SessionResponse } from "@/app/api/session/route";
import { PersonaMascot, PERSONA_META } from "@/components/mascot";
import { CallStage, type EndPayload } from "@/components/CallStage";
import { ReportView } from "@/components/ReportView";
import { BrandCard, Wordmark } from "@/components/Brand";

type Step = "setup" | "loading" | "interview" | "gate" | "negotiation" | "report";

const SAMPLE_RESUME = `Gokul Rajan. Software engineer, 3 years. Built React/Next.js dashboards, Python data pipelines, Supabase backends. Won Titanom x DeutschlandGPT hackathon with an AI micro-lesson app. MSc, Munich.`;
const SAMPLE_JD = `Senior Frontend Engineer, Berlin fintech. React, TypeScript, testing culture, mentoring juniors, leading feature delivery. Experience with payments or regulated environments preferred.`;

export default function Page() {
  const [step, setStep] = useState<Step>("setup");
  const [persona, setPersona] = useState<Persona>("engineer");
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [setup, setSetup] = useState<SetupResult | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [verdict, setVerdict] = useState<EndPayload | null>(null);
  const [interviewReport, setInterviewReport] = useState<InterviewReport | null>(null);
  const [negReport, setNegReport] = useState<NegotiationReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const active: Persona = step === "negotiation" ? "hr" : persona;
  const accent = PERSONA_META[active].accent;
  useEffect(() => { document.documentElement.style.setProperty("--accent", accent); }, [accent]);

  const unlockedHr = verdict?.verdict === "advance";

  async function post<T>(url: string, body: unknown): Promise<T> {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? r.statusText);
    return j as T;
  }

  async function enterRoom() {
    setErr(null); setStep("loading");
    setBusy(persona === "hr" ? "Alice is pulling up the offer…" : `${PERSONA_META[persona].name} is reading your resume…`);
    try {
      const s = await post<SetupResult>("/api/setup", { resume, jd, persona });
      setSetup(s);
      const sess = await post<SessionResponse>("/api/session", { persona, setup: s, resume, jd });
      setSession(sess); setStep(persona === "hr" ? "negotiation" : "interview");
    } catch (e) { setErr((e as Error).message); setStep("setup"); }
    finally { setBusy(null); }
  }

  async function onInterviewEnd(transcript: TranscriptLine[], payload: EndPayload) {
    setVerdict(payload); setStep("gate");
    post<Report>("/api/analyze", { round: "interview", transcript, setup, verdict: payload.verdict })
      .then((r) => {
        const rep = r as InterviewReport;
        setInterviewReport(rep);
        // If the agent never spoke a clear verdict, take the one the debrief derived.
        if (payload.verdict !== "advance" && payload.verdict !== "reject") setVerdict({ ...payload, verdict: rep.verdict });
        // Show the score automatically once it is ready.
        setTimeout(() => setStep((cur) => (cur === "gate" ? "report" : cur)), 2500);
      })
      .catch((e) => setErr((e as Error).message));
  }

  async function startNegotiation() {
    setErr(null); setStep("loading"); setBusy("Alice is pulling up the offer…");
    try {
      const sess = await post<SessionResponse>("/api/session", { persona: "hr", setup, resume, jd });
      setSession(sess); setStep("negotiation");
    } catch (e) { setErr((e as Error).message); setStep("gate"); }
    finally { setBusy(null); }
  }

  async function onNegotiationEnd(transcript: TranscriptLine[], payload: EndPayload) {
    setStep("report"); setBusy("Scoring the negotiation…");
    try {
      const r = await post<Report>("/api/analyze", { round: "negotiation", transcript, setup, verdict: payload.outcome, finalNumber: payload.final_number });
      setNegReport(r as NegotiationReport);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }

  useEffect(() => {
    if (step !== "report" || (!interviewReport && !negReport)) return;
    try {
      const prev = JSON.parse(localStorage.getItem("int-review-sessions") ?? "[]");
      localStorage.setItem("int-review-sessions", JSON.stringify([...prev, { at: Date.now(), persona, interviewReport, negReport }].slice(-10)));
    } catch {}
  }, [step, interviewReport, negReport, persona]);

  const others = (["founder", "engineer", "hr"] as Persona[]).filter((p) => p !== active);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Wordmark size={26} />
          <span className="hidden text-xs text-white/40 sm:inline">mock interviews with personas who hide what they think</span>
        </div>
        <div className="flex items-center gap-2">
          {others.map((p) => {
            const canSwitch = step === "setup";
            return (
              <button key={p} onClick={() => canSwitch && setPersona(p)} disabled={!canSwitch} title={`${PERSONA_META[p].name} · ${PERSONA_META[p].title}`}
                className={`relative rounded-2xl border border-white/10 bg-white/5 p-1 transition ${canSwitch ? "opacity-70 hover:opacity-100" : "opacity-35"}`}>
                <PersonaMascot persona={p} size={52} />
              </button>
            );
          })}
        </div>
      </header>

      {err && <div className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}

      {step === "setup" && <div className="mb-10"><BrandCard /></div>}
      {step === "setup" && (
        <section className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-start">
          <div className="flex flex-col items-center gap-3">
            <PersonaMascot persona={persona} size={260} />
            <div className="text-center"><div className="text-2xl font-semibold">{PERSONA_META[persona].name}</div><div className="text-sm text-white/50">{PERSONA_META[persona].title}</div></div>
            <div className="flex gap-2">
              {(["founder", "engineer", "hr"] as Persona[]).map((p) => (
                <button key={p} onClick={() => setPersona(p)} className={p === persona ? "btn-accent" : "btn-ghost"}>{PERSONA_META[p].title}</button>
              ))}
            </div>
            <p className="max-w-xs text-center text-xs text-white/45">{persona === "founder" ? "Chill, curious, wants to know if you can ship. Easy to relax around, which is the trap." : persona === "hr" ? "Polite, immovable, and holding a number she will not say out loud. Skip straight to the offer call." : "Strict, terse, pushes on every detail. Vague answers cost you."}</p>
          </div>
          <div className="glass space-y-4 p-6">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-white/50">Your resume</label>
              <textarea className="field h-40" value={resume} onChange={(e) => setResume(e.target.value)} placeholder="Paste your resume text…" />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-white/50">Job description</label>
              <textarea className="field h-32" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job posting…" />
            </div>
            <div className="flex items-center gap-3">
              <button className="btn-accent" disabled={!resume.trim() || !jd.trim()} onClick={enterRoom}>Enter the room</button>
              <button className="btn-ghost" onClick={() => { setResume(SAMPLE_RESUME); setJd(SAMPLE_JD); }}>Use sample</button>
              <span className="text-xs text-white/35">Three questions with the interviewer, then the offer call with Alice. Or pick Alice and skip straight to the number.</span>
            </div>
          </div>
        </section>
      )}

      {step === "loading" && (
        <section className="flex flex-col items-center gap-4 py-10">
          <PersonaMascot persona={active} state="thinking" size={260} />
          <p className="text-white/60">{busy}</p>
        </section>
      )}

      {step === "interview" && session && <CallStage persona={persona} round="interview" session={session} onEnd={onInterviewEnd} />}
      {step === "negotiation" && session && <CallStage persona="hr" round="negotiation" session={session} onEnd={onNegotiationEnd} />}

      {step === "gate" && (
        <section className="flex flex-col items-center gap-6 py-6 text-center">
          <PersonaMascot persona={persona} state="idle" size={240} />
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
            {unlockedHr ? "Congratulations! You are selected for the next round!" : "We will get back to you."}
          </h1>
          {verdict?.reason && <p className="max-w-xl text-white/55">“{verdict.reason}”</p>}
          {typeof verdict?.impression === "number" && <p className="font-mono text-sm text-white/50">hidden impression score revealed: <span className="text-[var(--accent)]">{verdict.impression}/100</span></p>}
          {!interviewReport && <p className="text-xs text-white/40">Scoring your answers… the debrief opens automatically.</p>}
          <div className="flex gap-3">
            <button className="btn-accent" onClick={startNegotiation}>Take the offer call</button>
            <button className="btn-ghost" onClick={() => setStep("report")}>{interviewReport ? "See the debrief" : "Debrief is being written…"}</button>
          </div>
        </section>
      )}

      {step === "report" && (
        <section className="space-y-10">
          {busy && <p className="text-white/60">{busy}</p>}
          {interviewReport ? <ReportView report={interviewReport} accent={PERSONA_META[persona].accent} /> : !negReport && <p className="text-white/50">Writing the interview debrief…</p>}
          {negReport && <ReportView report={negReport} accent={PERSONA_META.hr.accent} />}
          <div className="flex gap-3 pb-10">
            {interviewReport && !negReport && <button className="btn-accent" onClick={startNegotiation}>Take the offer call</button>}
            <button className="btn-ghost" onClick={() => location.reload()}>Run it again</button>
          </div>
        </section>
      )}
    </main>
  );
}
