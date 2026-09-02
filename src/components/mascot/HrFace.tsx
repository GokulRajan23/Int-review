import type { FaceProps } from "./Mascot";

export const hrMeta = { name: "Alice", title: "HR Negotiator", accent: "#b48cff", headShape: "round" as const };

/** Alice: polished, confident HR negotiator. Round dot eyes, calm even brows, polite slight smile, thin round glasses. */
export function HrFace({ state: _state }: FaceProps) {
  return (
    <>
      {/* glasses: round lenses, bridge, temples */}
      <circle className="accessory" cx="75" cy="95" r="15" />
      <circle className="accessory" cx="125" cy="95" r="15" />
      <path className="accessory" d="M90 94 Q100 90 110 94" />
      <path className="accessory" d="M60 93 L47 90" />
      <path className="accessory" d="M140 93 L153 90" />
      {/* hair sweep + earring */}
      <path className="accessory" d="M56 62 Q80 50 108 58" opacity=".6" />
      <circle className="accessory" cx="43" cy="112" r="2" opacity=".7" />
      {/* brows: thin gentle arcs */}
      <path className="brow" d="M63 74 Q75 69 87 74" />
      <path className="brow" d="M113 74 Q125 69 137 74" />
      {/* eyes */}
      <circle className="eye" cx="75" cy="95" r="6" />
      <circle className="eye" cx="125" cy="95" r="6" />
      {/* mouth: polite, barely curved */}
      <path className="mouth" d="M89 125 Q100 129 111 125" />
    </>
  );
}
