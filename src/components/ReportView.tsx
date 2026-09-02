"use client";

import type { InterviewReport, NegotiationReport, Report } from "@/lib/types";
import type { CSSProperties, ReactNode } from "react";

const fmt = (n: number) => n.toLocaleString("de-DE");
const pct = (n: number) => `${Math.round(n * 100)} %`;

export function ReportView({ report, accent }: { report: Report; accent: string }) {
  const style = { "--accent": accent } as CSSProperties;
  return (
    <div style={style} className="min-h-screen bg-[#070b12] px-4 py-10 text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {report.round === "interview" ? <Interview r={report} /> : <Negotiation r={report} />}
      </div>
    </div>
  );
}

/* ---------- shared pieces ---------- */

function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur ${className}`}>
      {title && <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">{title}</h2>}
      {children}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>{value}</div>
      <div className="mt-1 text-xs text-white/50">{label}</div>
    </div>
  );
}

function Bars({ title, data, unit }: { title: string; data: Record<string, number>; unit: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  const callout = ratioCallout(entries, unit);
  return (
    <div>
      <h3 className="mb-2 text-sm text-white/70">{title}</h3>
      <div className="flex flex-col gap-2">
        {entries.map(([theme, v]) => (
          <div key={theme} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="truncate capitalize text-white/70">{theme}</span>
            <div className="h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full" style={{ width: `${(v / max) * 100}%`, background: "var(--accent)" }} />
            </div>
            <span className="text-right tabular-nums text-white/60">{v.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</span>
          </div>
        ))}
      </div>
      {callout && <p className="mt-3 text-sm text-white/80">{callout}</p>}
    </div>
  );
}

function ratioCallout(entries: [string, number][], unit: string) {
  const [hi, lo] = [entries[0], entries[entries.length - 1]];
  if (!hi || !lo || hi === lo || lo[1] <= 0 || hi[1] < 2 * lo[1]) return null;
  return `${Math.round(hi[1] / lo[1])}x more ${unit} during ${hi[0]} than ${lo[0]}`;
}

function Rewrite({ original, better, label }: { original: string; better: string; label: string }) {
  return (
    <Panel title={`Rewrite · ${label}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 p-4 text-sm leading-relaxed text-white/45">
          <div className="mb-2 text-xs uppercase tracking-wider text-white/30">What you said</div>
          {original}
        </div>
        <div className="rounded-xl border p-4 text-sm leading-relaxed text-white/90" style={{ borderColor: "var(--accent)" }}>
          <div className="mb-2 text-xs uppercase tracking-wider" style={{ color: "var(--accent)" }}>Better</div>
          {better}
        </div>
      </div>
    </Panel>
  );
}

function Summary({ lines }: { lines: string[] }) {
  return (
    <Panel title="What the coach heard">
      <ul className="flex flex-col gap-2 text-sm leading-relaxed text-white/85">
        {lines.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span style={{ color: "var(--accent)" }}>—</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---------- interview ---------- */

function Interview({ r }: { r: InterviewReport }) {
  const advance = r.verdict === "advance";
  const { aggregate: a, patterns: p } = r;
  return (
    <>
      <Panel className={advance ? "" : "border-red-500/20 bg-red-500/5"}>
        <p className="text-3xl font-semibold leading-tight md:text-4xl" style={advance ? { color: "var(--accent)" } : { color: "rgb(252 165 165 / 0.8)" }}>
          {advance ? "Congratulations! You are selected for the next round!" : "We will get back to you."}
        </p>
        <p className="mt-2 text-sm text-white/50">Decided by answer {r.decidingAnswerIndex + 1}</p>
      </Panel>

      <Panel title="Patterns">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label={`fillers · ${a.fillersPerHundredWords.toLocaleString("de-DE", { maximumFractionDigits: 1 })} per 100 words`} value={fmt(a.totalFillers)} />
          <Tile label="STAR coverage" value={pct(p.starCoverage)} />
          <Tile label="weakest theme" value={p.weakestTheme} />
          <Tile label="length outliers" value={fmt(a.outlierIndices.length)} />
        </div>
      </Panel>

      <Panel title="Fillers by question type" className="flex flex-col gap-6">
        <Bars title="Fillers per 100 words" data={p.fillersByTheme} unit="fillers" />
        <Bars title="Hedges per 100 words" data={p.hedgesByTheme} unit="hedges" />
      </Panel>

      <Panel title="STAR coverage">
        <div className="flex flex-col gap-2">
          {r.answers.map((ans, i) => {
            const j = r.judgments.find((x) => x.index === ans.index) ?? r.judgments[i];
            const star = j ? [j.star.situation, j.star.task, j.star.action, j.star.result] : [false, false, false, false];
            return (
              <div key={ans.index} className="grid grid-cols-[2.5rem_auto_1fr_auto] items-center gap-3 text-sm">
                <span className="font-medium text-white/70">Q{i + 1}</span>
                <div className="flex gap-1">
                  {["S", "T", "A", "R"].map((l, k) => (
                    <span key={l} className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold ${star[k] ? "text-[#070b12]" : "bg-white/5 text-white/25"}`} style={star[k] ? { background: "var(--accent)" } : undefined}>{l}</span>
                  ))}
                </div>
                <span className="text-white/50">
                  {j ? `${fmt(j.wordsBeforePoint)} words to the point` : ""}
                  {ans.isLengthOutlier && <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-xs text-amber-300">long</span>}
                </span>
                <span className="tabular-nums text-white/60">{j ? fmt(j.confidence) : "–"}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      {a.repeatedStarters.length > 0 && (
        <Panel title="Repeated sentence starters">
          <ul className="flex flex-wrap gap-2 text-sm">
            {a.repeatedStarters.map((s) => (
              <li key={s.starter} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/80">
                &ldquo;{s.starter}&rdquo; <span style={{ color: "var(--accent)" }}>×{s.count}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Summary lines={r.summary} />
      <Rewrite label={`Q${r.rewrite.index + 1}`} original={r.rewrite.original} better={r.rewrite.better} />
    </>
  );
}

/* ---------- negotiation ---------- */

function Negotiation({ r }: { r: NegotiationReport }) {
  const label = { accepted: "Offer accepted", walked: "You walked away", final: "Final offer", unknown: "Round ended" }[r.outcome];
  const span = Math.max(1, r.ceiling - r.openingOffer);
  const marker = r.finalNumber == null ? null : Math.min(100, Math.max(0, ((r.finalNumber - r.openingOffer) / span) * 100));
  return (
    <>
      <Panel>
        <p className="text-sm uppercase tracking-[0.2em] text-white/50">{label}</p>
        <p className="mt-1 text-4xl font-semibold" style={{ color: "var(--accent)" }}>{r.finalNumber == null ? "No number" : fmt(r.finalNumber)}</p>
        <div className="relative mt-6 h-2 rounded-full bg-white/10">
          {marker != null && (
            <>
              <div className="h-2 rounded-full" style={{ width: `${marker}%`, background: "var(--accent)" }} />
              <div className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-full bg-white" style={{ left: `${marker}%` }} />
            </>
          )}
        </div>
        <div className="mt-2 flex justify-between text-xs text-white/50">
          <span>Opening {fmt(r.openingOffer)}</span>
          <span>Ceiling {fmt(r.ceiling)}</span>
        </div>
        <p className="mt-4 text-sm text-white/80">You captured {pct(r.capturedShareOfRange)} of the hidden range.</p>
        <p className="mt-1 text-sm font-medium" style={{ color: "var(--accent)" }}>Their real ceiling was {fmt(r.ceiling)}</p>
      </Panel>

      <Panel title="Leverage credibility">
        <p className="mb-3 text-xs text-white/45">How believable your case for the number was, whether market data or a competing offer. Vague claims score low, specifics score high.</p>
        <div className="flex items-center gap-4">
          <div className="h-2 flex-1 rounded-full bg-white/10">
            <div className="h-2 rounded-full" style={{ width: `${r.competingOfferCredibility}%`, background: "var(--accent)" }} />
          </div>
          <span className="w-16 text-right text-lg font-semibold tabular-nums">{fmt(r.competingOfferCredibility)}/100</span>
        </div>
      </Panel>

      <Panel title="Moves">
        <ol className="flex flex-col gap-4">
          {(Array.isArray(r.moves) ? r.moves : []).map((m) => (
            <li key={m.index} className="border-l-2 pl-4" style={{ borderColor: "var(--accent)" }}>
              <p className="text-sm italic text-white/80">&ldquo;{m.userLine}&rdquo;</p>
              <p className="mt-1 text-sm text-white/50">{m.effect}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <Summary lines={r.summary} />
      <Rewrite label="your key line" original={r.rewrite.original} better={r.rewrite.better} />
    </>
  );
}
