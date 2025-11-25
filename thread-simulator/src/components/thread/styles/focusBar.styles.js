export const barContainer = {
  height: "180px",
  width: "22px",
  display: "flex",
  alignItems: "flex-end",
};

export const barTrack = {
  width: "100%",
  height: "100%",
  background: "#E5E7EB",
  borderRadius: "999px",
  position: "relative",
  overflow: "hidden",
};

export const barFillGradient = {
  width: "100%",
  background: "linear-gradient(to bottom, #FDE68A, #FBBF24, #F97316)",
  borderRadius: "999px",
  position: "absolute",
  bottom: 0,
  left: 0,
  transformOrigin: "bottom",
  transform: "scaleY(0)",
  transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
};

export const barGlowWrapper = {
  position: "relative",
  width: "12px",
  flexGrow: 1,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
};

export const dangerPulse = {
  animation: "dangerPulse 1.2s ease-in-out infinite",
};

export const keyframes = `
@keyframes dangerPulse {
  0%   { box-shadow: 0 0 0px rgba(220, 38, 38, 0.15); }
  50%  { box-shadow: 0 0 18px rgba(220, 38, 38, 0.4); }
  100% { box-shadow: 0 0 0px rgba(220, 38, 38, 0.15); }
}
`;
