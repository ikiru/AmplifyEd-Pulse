import styled from "styled-components";

export const Container = styled.div`
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid ${({ theme }) => theme.borderLight};
  background-color: ${({ theme }) => theme.bgInput};
`;

export const TextInput = styled.textarea`
  flex: 1;
  min-height: 2.5rem;
  max-height: 6rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid ${({ theme }) => theme.borderMedium};
  background: ${({ theme }) => theme.bgInputField};
`;

export const SendButton = styled.button`
  margin-left: 0.75rem;
  background: ${({ theme }) => theme.primary};
  color: #fff;
`;
