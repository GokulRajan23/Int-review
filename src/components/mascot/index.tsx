"use client";
import type { Persona } from "@/lib/types";
import { Mascot, type MascotState } from "./Mascot";
import { FounderFace, founderMeta } from "./FounderFace";
import { EngineerFace, engineerMeta } from "./EngineerFace";
import { HrFace, hrMeta } from "./HrFace";

export const PERSONA_META = {
  founder: { ...founderMeta, face: FounderFace },
  engineer: { ...engineerMeta, face: EngineerFace },
  hr: { ...hrMeta, face: HrFace },
} as const;

export function PersonaMascot({ persona, state = "idle", size = 220, className }: { persona: Persona; state?: MascotState; size?: number; className?: string }) {
  const m = PERSONA_META[persona];
  return <Mascot accent={m.accent} state={state} size={size} face={m.face} headShape={m.headShape} className={className} />;
}
export type { MascotState };
