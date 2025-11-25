// thread-simulator/src/components/facilitator/styles/intensity.styles.js
import styled, { keyframes } from "styled-components";

const haloPulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55);
  }
  70% {
    box-shadow: 0 0 24px 8px rgba(239, 68, 68, 0.35);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
`;

export const HaloWrapper = styled.div`
  border-radius: 10px;
  transition: all 0.2s ease;

  &.extreme {
    animation: ${haloPulse} 1.6s ease-in-out infinite;
  }
`;

export const TooltipWrapper = styled.div`
  position: relative;
  display: inline-block;

  &:hover > div {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(-4px);
  }
`;

export const Tooltip = styled.div`
  position: absolute;
  left: 16px;
  top: 0;
  padding: 0.35rem 0.55rem;
  background: #111827;
  color: #ffffff;
  font-size: 0.75rem;
  border-radius: 6px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 1000;
`;

export const BarContainer = styled.div`
  width: 14px;
  height: 140px;
  background: #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
`;

export const BarFill = styled.div`
  width: 100%;
  transition: height 0.25s ease, background-color 0.3s ease;
  background: ${({ $value }) => {
    const val = Math.max(0, Math.min(Number($value) || 0, 100));
    if (val < 40) return "rgba(59,130,246,0.65)";
    if (val < 70) return "rgba(251,191,36,0.75)";
    return "rgba(239,68,68,0.85)";
  }};
`;
