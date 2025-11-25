// thread-simulator/src/components/facilitator/IntensityBar.jsx
import React from "react";
import {
  BarContainer,
  BarFill,
  TooltipWrapper,
  Tooltip,
  HaloWrapper,
} from "./styles/intensity.styles.js";

export default function IntensityBar({ intensity = 0, reasons = [] }) {
  const value = Math.max(0, Math.min(intensity, 100));
  const isExtreme = value >= 80;

  return (
    <HaloWrapper className={isExtreme ? "extreme" : ""}>
      <TooltipWrapper>
        <Tooltip>
          {reasons.length === 0 && <div>No active signals</div>}
          {reasons.map((reason, idx) => (
            <div key={`reason-${idx}`}>• {reason}</div>
          ))}
        </Tooltip>

        <BarContainer aria-label="Thread intensity indicator (facilitator only)">
          <BarFill $value={value} style={{ height: `${value}%` }} />
        </BarContainer>
      </TooltipWrapper>
    </HaloWrapper>
  );
}
