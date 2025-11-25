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

export const barFill = {
  width: "100%",
  background: "#E5E7EB",
  borderRadius: "999px",
  position: "absolute",
  bottom: 0,
  left: 0,
  transformOrigin: "bottom",
  transform: "scaleY(0)",
  transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
};
