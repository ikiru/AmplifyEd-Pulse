import styled from "styled-components";

export const Panel = styled.div`
  background: #ffffff;
  border-radius: 14px;
  padding: 1rem 1.2rem;
  box-shadow: 0 6px 24px rgba(15, 23, 42, 0.07);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  border: 1px solid #e5e7eb;
`;

export const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

export const Label = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
`;

export const Value = styled.div`
  font-size: 0.9rem;
  color: #111827;
  font-weight: 500;
  padding: 0.4rem 0.65rem;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
`;

export const CooldownBar = styled.div`
  width: 100%;
  height: 6px;
  background: #e5e7eb;
  border-radius: 40px;
  overflow: hidden;
  margin-top: 0.3rem;
`;

export const CooldownFill = styled.div`
  height: 100%;
  background: #4f46e5;
  width: ${({ pct }) => pct}%;
  transition: width 150ms linear;
`;
