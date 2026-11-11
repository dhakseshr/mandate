import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, mono, sans, serif } from "../theme";

export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 over [from, from+dur] frames, eased. */
export function useProgress(from: number, dur: number, easing = ease) {
  const f = useCurrentFrame();
  return interpolate(f, [from, from + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}

/** Security paper: the app's background colour, fine grain, a faint vignette. */
export const Paper: React.FC<{ dark?: boolean; children?: React.ReactNode }> = ({ dark, children }) => (
  <AbsoluteFill style={{ background: dark ? C.night : C.bg }}>
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile("textures/paper-grain.webp")})`,
        backgroundSize: "512px 512px",
        opacity: dark ? 0.08 : 0.55,
        mixBlendMode: dark ? "screen" : "multiply",
      }}
    />
    <AbsoluteFill style={{ background: dark ? "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.55))" : "radial-gradient(ellipse at center, transparent 55%, rgba(60,50,30,.12))" }} />
    {children}
  </AbsoluteFill>
);

/** The engraved lathe-work border strip from the 1863 ABNC certificate (CC0), tinted by mask. */
export const Lathe: React.FC<{ width: number; color?: string; style?: React.CSSProperties }> = ({ width, color = C.ink, style }) => (
  <div
    style={{
      width,
      height: 18,
      background: color,
      WebkitMaskImage: `url(${staticFile("textures/abnc-lathe-1863.png")})`,
      WebkitMaskSize: "auto 18px",
      WebkitMaskRepeat: "repeat-x",
      opacity: 0.85,
      ...style,
    }}
  />
);

/** Small caps label, the app's `.label`. */
export const Label: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({ children, color = C.ink, size = 20, style }) => (
  <div style={{ fontFamily: sans, fontWeight: 600, fontSize: size, letterSpacing: "0.14em", textTransform: "uppercase", color, ...style }}>{children}</div>
);

/** Microprint ribbon, like the app's header band. */
export const Microprint: React.FC<{ y?: number; dark?: boolean; offset?: number }> = ({ y = 0, dark, offset = 0 }) => {
  const f = useCurrentFrame();
  const text = "WRIT · LIMITED AUTHORITY TO PURCHASE · VOID UNLESS SIGNED · DECIDED BY CODE, NOT A MODEL · MONEY HELD BY PAYPAL · ";
  return (
    <div style={{ position: "absolute", top: y, left: 0, right: 0, height: 22, overflow: "hidden", borderBottom: `1px solid ${dark ? "#2a2a25" : C.line}` }}>
      <div style={{ whiteSpace: "nowrap", fontFamily: mono, fontSize: 12, letterSpacing: "0.3em", color: dark ? "#6f6a5f" : "#8a8476", transform: `translateX(${-((f * 0.6 + offset) % 1200)}px)`, lineHeight: "22px" }}>
        {text.repeat(8)}
      </div>
    </div>
  );
};

/** Words that ink in one by one (opacity + slight rise + de-blur). */
export const InkWords: React.FC<{ text: string; start: number; per?: number; style?: React.CSSProperties; wordStyle?: (w: string, i: number) => React.CSSProperties | undefined }> = ({ text, start, per = 4, style, wordStyle }) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  return (
    <span style={style}>
      {words.map((w, i) => {
        const p = interpolate(f, [start + i * per, start + i * per + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 18}px)`, filter: `blur(${(1 - p) * 6}px)`, marginRight: "0.26em", ...wordStyle?.(w, i) }}>
            {w}
          </span>
        );
      })}
    </span>
  );
};

/** Big Bodoni statement. */
export const Statement: React.FC<{ children: React.ReactNode; size?: number; color?: string; italic?: boolean; style?: React.CSSProperties }> = ({ children, size = 96, color = C.ink, italic, style }) => (
  <div style={{ fontFamily: serif, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.02em", color, fontStyle: italic ? "italic" : "normal", fontWeight: 400, ...style }}>{children}</div>
);

/** A caption chip: mono text on paper, a hairline frame, slides in. */
export const Chip: React.FC<{ children: React.ReactNode; start: number; tone?: keyof typeof C; x: number; y: number; size?: number; anchor?: "left" | "right" }> = ({ children, start, tone = "ink", x, y, size = 24, anchor = "left" }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - start, fps, config: { damping: 200, mass: 0.6 } });
  if (f < start) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        [anchor]: x,
        transform: `translateY(${(1 - s) * 16}px)`,
        opacity: s,
        background: C.surface,
        border: `1.5px solid ${C[tone]}`,
        color: C[tone],
        fontFamily: mono,
        fontSize: size,
        padding: "10px 18px",
        boxShadow: "0 18px 40px -20px rgba(18,18,16,.45)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
};

/** Section slate, "§ 3 · THE WORK", that wipes on with a rule. */
export const Slate: React.FC<{ n: string; title: string; start?: number; x?: number; y?: number; dark?: boolean }> = ({ n, title, start = 0, x = 96, y = 70, dark }) => {
  const p = useProgress(start, 18);
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: 18, opacity: p }}>
      <div style={{ fontFamily: serif, fontSize: 30, color: dark ? C.nightInk : C.ink }}>§ {n}</div>
      <div style={{ width: 80 * p, height: 1.5, background: dark ? C.nightInk : C.ink }} />
      <Label size={18} color={dark ? C.nightInk : C.ink}>{title}</Label>
    </div>
  );
};

export const Img2 = Img;
