// src/hooks/useInterpreter.js
import { useEffect, useState } from "react";
import { engineClient } from "../api/engineClient";

export function useInterpreter(sessionId = "default") {
  const [interpreter, setInterpreter] = useState(null);

  async function refresh() {
    const data = await engineClient.getInterpreterState(sessionId);
    setInterpreter(data);
  }

  useEffect(() => {
    refresh();
  }, [sessionId]);

  return {
    interpreter,
    refresh,
    setInterpreter,
  };
}
