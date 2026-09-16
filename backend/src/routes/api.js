const express = require("express");
const { listSessions, getSession, STATES } = require("../data/sessions");
const { classifySession } = require("../services/classify");
const { extractSignals } = require("../services/signals");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "intentlab",
    llmConfigured: Boolean(process.env.OPENAI_API_KEY),
    states: STATES,
  });
});

router.get("/sessions", (_req, res) => {
  res.json({ sessions: listSessions() });
});

router.get("/sessions/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json({ session });
});

router.post("/signals", (req, res) => {
  const events = req.body?.events;
  if (!Array.isArray(events)) {
    return res.status(400).json({ error: "body.events must be an array" });
  }
  res.json(extractSignals(events));
});

router.post("/classify", async (req, res) => {
  try {
    const events = req.body?.events;
    const result = await classifySession(events);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Classify failed" });
  }
});

module.exports = router;
