import express from "express";
import { createSession } from "../services/sessionService.js";

const router = express.Router();

router.post("/sessions", (req, res) => {
  const { title, pdType } = req.body || {};
  if (!title || !pdType) {
    return res.status(400).json({ error: "title and pdType are required." });
  }

  const session = createSession({ title, pdType });
  return res.json(session);
});

export default router;
