import type { FaceProps } from "./Mascot";

export const engineerMeta = {
  name: "Daniel",
  title: "Skeptical Engineer",
  accent: "#3fd0e6",
  headShape: "square" as const,
};

/** Daniel: flat visor-bar eyes, one raised brow, unimpressed mouth, thin visor frame + antenna nubs. */
export function EngineerFace({ state }: FaceProps) {
  const thinking = state === "thinking";
  return (
    <>
      {/* visor frame around both eyes */}
      <rect className="accessory" x="55" y="84" width="90" height="22" rx="6" />
      {/* antenna nubs + tiny circuit trace on head top */}
      <path className="accessory" d="M84 45 v-8 h-6" opacity=".8" />
      <path className="accessory" d="M116 45 v-8 h6" opacity=".8" />
      <path className="accessory" d="M94 40 h12" opacity=".6" />
      {/* brows: left raised and angled, right flat */}
      <path className="brow" d="M60 76 L88 70" />
      <path className="brow" d="M112 78 L140 78" />
      {/* eyes: flat horizontal visor bars */}
      <rect className="eye" x="62" y="92" width="26" height="6" rx="3" />
      <rect className="eye" x="112" y="92" width="26" height="6" rx="3" />
      {/* mouth: flat, very slightly downturned */}
      <path className="mouth" d="M88 125 L112 127" opacity={thinking ? 0.7 : 1} />
    </>
  );
}
