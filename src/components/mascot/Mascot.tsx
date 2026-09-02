"use client";
import "./mascot.css";
import type { ReactNode } from "react";

export type MascotState = "idle" | "listening" | "speaking" | "thinking";

export interface FaceProps {
  /** Face layer draws inside the head box: x 40..160, y 45..150 (viewBox 0 0 200 200). Eye centers ~ (75,95) and (125,95). Mouth ~ y 125. */
  state: MascotState;
}

interface MascotProps {
  state?: MascotState;
  accent: string; // CSS color
  size?: number; // px
  /** Face component renders eyes/brows/mouth/accessory using classes .eye .brow .mouth .accessory */
  face: (p: FaceProps) => ReactNode;
  /** Head shape: "round" (founder, hr) or "square" (engineer) */
  headShape?: "round" | "square";
  className?: string;
}

/** Shared shell: glowing pill head, tiny body, one gradient. Faces plug in via `face`. */
export function Mascot({ state = "idle", accent, size = 220, face, headShape = "round", className }: MascotProps) {
  const rx = headShape === "square" ? 22 : 52;
  return (
    <svg
      className={`mascot ${className ?? ""}`}
      data-state={state}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      style={{ ["--accent" as string]: accent }}
      aria-hidden
    >
      <defs>
        <linearGradient id="mascotShine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* body */}
      <rect className="body" x="70" y="148" width="60" height="26" rx="12" />
      <circle className="body" cx="62" cy="172" r="7" />
      <circle className="body" cx="138" cy="172" r="7" />
      {/* head */}
      <rect className="head" x="40" y="45" width="120" height="105" rx={rx} />
      <rect className="head-shine" x="52" y="52" width="96" height="30" rx={headShape === "square" ? 12 : 30} />
      {/* face layer */}
      <g className="face">{face({ state })}</g>
    </svg>
  );
}
