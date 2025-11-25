// thread-simulator/src/components/thread/styles/messageInput.styles.js
import styled from "styled-components";

export const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  padding-bottom: 1rem;
  border-top: 1px solid ${({ theme }) => theme.borderLight};
  background-color: ${({ theme }) => theme.bgInput};
  box-sizing: border-box;
`;

export const TextInput = styled.textarea`
  flex: 1;
  min-height: 2.5rem;
  max-height: 8rem;
  padding: 0.55rem 0.75rem;
  background-color: ${({ theme }) => theme.bgInputField};
  color: ${({ theme }) => theme.textPrimary};
  border: 1px solid ${({ theme }) => theme.borderMedium};
  border-radius: 0.5rem;
  font-size: 1rem;
  resize: vertical;
  outline: none;
  line-height: 1.4;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;

  &:focus {
    border-color: ${({ theme }) => theme.primary};
    box-shadow: 0 0 0 3px rgba(${({ theme }) => theme.primaryRgb}, 0.25);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const SendButton = styled.button`
  padding: 0.55rem 1.05rem;
  background-color: ${({ theme, disabled }) =>
    disabled ? theme.buttonDisabledBg : theme.primary};
  color: ${({ theme, disabled }) =>
    disabled ? theme.buttonDisabledText : theme.buttonText};
  border: none;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;

  &:hover {
    background-color: ${({ theme, disabled }) =>
      disabled ? theme.buttonDisabledBg : theme.primaryDark};
  }

  &:active {
    transform: ${({ disabled }) => (disabled ? "none" : "scale(0.97)")};
  }
`;
