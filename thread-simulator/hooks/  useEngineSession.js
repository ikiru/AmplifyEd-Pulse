// src/hooks/useEngineSession.js
import { useEffect, useState } from "react";
import { engineClient } from "../api/engineClient";

export function useEngineSession(sessionId = "default") {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await engineClient.getSession(sessionId);
      setSession(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [sessionId]);

  return {
    session,
    loading,
    refresh: load,
  };
}

