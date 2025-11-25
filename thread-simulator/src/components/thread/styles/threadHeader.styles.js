import styled from "styled-components";

export const HeaderWrap = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0;
  margin: 0;
`;

export const Title = styled.h1`
  font-size: 1.05rem;
  font-weight: 700;
  margin: 0;
  padding: 0;
  color: #111827;
`;

export const Presence = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #eef2ff;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
`;

export const PresenceIcon = styled.span`
  font-size: 1rem;
`;

export const PresenceText = styled.span`
  font-weight: 600;
  font-size: 0.85rem;
  color: #1e293b;
`;
