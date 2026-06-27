const express = require("express");
const claudeController = require("../controllers/claudeController");
const nemotronController = require("../controllers/nemotronController");
const mlController = require("../controllers/mlController");
const logger = require("../utils/logger");

const router = express.Router();

const URGENCY_ORDER = { low: 0, moderate: 1, high: 2, emergency: 3 };

const buildConsensus = (results) => {
  const successful = results.filter((r) => r.status === "success" && r.analysis);

  if (successful.length === 0) {
    return {
      urgency: "moderate",
      recommendedSpecialty: "General Practice",
      agreement: 0,
      note: "No models returned a successful analysis",
    };
  }

  const urgencies = successful.map((r) => r.analysis.urgency);
  const maxUrgency = urgencies.reduce(
    (max, u) => (URGENCY_ORDER[u] > URGENCY_ORDER[max] ? u : max),
    "low"
  );

  const specialtyCounts = {};
  successful.forEach((r) => {
    const specialty = r.analysis.recommendedSpecialty;
    specialtyCounts[specialty] = (specialtyCounts[specialty] || 0) + 1;
  });

  const recommendedSpecialty = Object.entries(specialtyCounts).sort(
    (a, b) => b[1] - a[1]
  )[0][0];

  const urgencyAgreement =
    urgencies.filter((u) => u === maxUrgency).length / successful.length;

  return {
    urgency: maxUrgency,
    recommendedSpecialty,
    agreement: Math.round(urgencyAgreement * 100) / 100,
    modelsAgreeing: successful.length,
    note:
      urgencyAgreement >= 0.67
        ? "Models largely agree on urgency level"
        : "Models show mixed urgency assessments — clinical review recommended",
  };
};

router.post("/", async (req, res, next) => {
  try {
    const { symptoms, age, gender, duration, severity, medicalHistory } = req.body;

    if (!symptoms || typeof symptoms !== "string" || !symptoms.trim()) {
      return res.status(400).json({ error: "symptoms is required and must be a non-empty string" });
    }

    const patientData = {
      symptoms: symptoms.trim(),
      age,
      gender,
      duration,
      severity,
      medicalHistory: Array.isArray(medicalHistory) ? medicalHistory : undefined,
    };

    logger.info("Starting multi-model analysis", { symptoms: patientData.symptoms });

    const start = Date.now();

    const [claude, nemotron, ml] = await Promise.all([
      claudeController.analyze(patientData),
      nemotronController.analyze(patientData),
      mlController.analyze(patientData),
    ]);

    const results = { claude, nemotron, ml };
    const consensus = buildConsensus([claude, nemotron, ml]);

    res.json({
      patientData,
      results,
      consensus,
      totalLatencyMs: Date.now() - start,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
