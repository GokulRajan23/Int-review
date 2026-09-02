import type { FaceProps } from "./Mascot";

export const founderMeta = { name: "Chris", title: "Founder", accent: "#f5b84a", headShape: "round" as const };

/** Chris, the chill founder: content half-moon eyes, soft brows, easy smile, hoodie drawstrings. */
export function FounderFace({ state: _state }: FaceProps) {
  return (
    <>
      {/* soft brows */}
      <path className="brow" d="M64 80 Q75 76 86 80" opacity=".35" />
      <path className="brow" d="M114 80 Q125 76 136 80" opacity=".35" />
      {/* relaxed half-moon eyes (flat bottoms) */}
      <path className="eye" d="M63 97 A12 10 0 0 1 87 97 Z" />
      <path className="eye" d="M113 97 A12 10 0 0 1 137 97 Z" />
      {/* easy smile */}
      <path className="mouth" d="M85 124 Q100 132 115 124" />
      {/* faint stubble */}
      <path className="accessory" d="M88 136h.6M94 140h.6M100 142h.6M106 140h.6M112 136h.6" opacity=".2" />
      {/* hoodie V-neck + drawstrings */}
      <path className="accessory" d="M82 148 Q100 164 118 148" />
      <path className="accessory" d="M94 153 L92 162" />
      <path className="accessory" d="M106 153 L108 162" />
    </>
  );
}
