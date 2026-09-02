"use client";

const BLUE = "#4f8ff7";
const AMBER = "#f5a524";

/** int_review () wordmark. `size` is the font size in px. */
export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-baseline font-mono font-bold leading-none tracking-tight" style={{ fontSize: size, fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}>
      <span style={{ color: BLUE }}>int</span>
      <span style={{ color: AMBER }}>_</span>
      <span className="text-white">review</span>
      <span className="ml-[0.4em]" style={{ color: AMBER }}>()</span>
    </span>
  );
}

/** Terminal-window brand card used as the hero on the setup screen. */
export function BrandCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 px-8 py-7 shadow-[0_30px_80px_-40px_rgba(79,143,247,.45)]" style={{ background: "linear-gradient(135deg,#0f1729 0%,#0d1526 55%,#111a2e 100%)" }}>
      <div className="flex gap-2.5">
        <span className="h-3.5 w-3.5 rounded-full bg-[#ff5f57]" />
        <span className="h-3.5 w-3.5 rounded-full bg-[#febc2e]" />
        <span className="h-3.5 w-3.5 rounded-full bg-[#28c840]" />
      </div>
      <p className="mt-6 font-mono text-base text-[#6f86ad]" style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>// ace every round</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-10 gap-y-4">
        <Wordmark size={60} />
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0a1120] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/90">
          <span className="h-2 w-2 rounded-full" style={{ background: BLUE }} />
          Practice. Review. Improve.
        </span>
      </div>
      <p className="mt-6 text-2xl font-bold text-[#c7d3e6]">Find your weak spots before they do.</p>
      <span className="mt-2 block h-1 w-24 rounded-full" style={{ background: BLUE }} />
    </div>
  );
}
