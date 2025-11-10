const express = require("express");
const { createSession } = require("../services/sessionService");

const router = express.Router();

router.post("/sessions", (req, res) => {
  const { title, pdType } = req.body || {};
  if (!title || !pdType) {
    return res.status(400).json({ error: "title and pdType are required." });
  }

  const session = createSession({ title, pdType });
  return res.json(session);
});

module.exports = router;
