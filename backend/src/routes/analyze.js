const express = require("express");
const { claudeTriage } = require("../controllers/claudeController");
const { nemotronTriage } = require("../controllers/nemotronController");
const { mlPredict } = require("../controllers/mlController");
const logger = require("../utils/logger");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const { symptoms_text, symptom_ids, age, sex } = req.body;

    if (!symptoms_text || typeof symptoms_text !== "string" || !symptoms_text.trim()) {
      return res.status(400).json({ error: "symptoms_text is required and must be a non-empty string" });
    }

    if (!Array.isArray(symptom_ids)) {
      return res.status(400).json({ error: "symptom_ids must be an array" });
    }

    if (age == null || typeof age !== "number") {
      return res.status(400).json({ error: "age is required and must be a number" });
    }

    if (!sex || typeof sex !== "string") {
      return res.status(400).json({ error: "sex is required and must be a string" });
    }

    logger.info("Starting multi-model analysis", { symptoms_text: symptoms_text.trim() });

    const startTime = Date.now();

    const [claudeResult, nemotronResult, mlResult] = await Promise.allSettled([
      claudeTriage(symptoms_text.trim(), age, sex),
      nemotronTriage(symptoms_text.trim(), age, sex),
      mlPredict(symptom_ids, age, sex),
    ]);

    const claude =
      claudeResult.status === "fulfilled"
        ? claudeResult.value
        : { severity: "yellow", error: true };
    const nemotron =
      nemotronResult.status === "fulfilled"
        ? nemotronResult.value
        : { severity: "yellow", error: true };
    const ml =
      mlResult.status === "fulfilled" ? mlResult.value : { ml_available: false };

    const models_agree = claude.severity === nemotron.severity;
    const consensus_label = models_agree
      ? "✓ Both AIs agree — high confidence"
      : "⚠ Models differ — Claude's assessment used";
    const consensus_type = models_agree ? "agree" : "differ";

    console.log(
      `\n╔══════════════════════════════════════════════════════╗` +
        `\n║  MediReach Demo — AI Triage Verdicts                 ║` +
        `\n╠══════════════════════════════════════════════════════╣` +
        `\n║  Claude:    ${(claude.severity || "n/a").toUpperCase().padEnd(40)}║` +
        `\n║  Nemotron:  ${(nemotron.severity || "n/a").toUpperCase().padEnd(40)}║` +
        `\n║  Consensus: ${consensus_type.toUpperCase().padEnd(40)}║` +
        `\n╚══════════════════════════════════════════════════════╝\n`
    );

    res.json({
      final_severity: claude.severity,
      consensus: {
        type: consensus_type,
        label: consensus_label,
        claude_severity: claude.severity,
        nemotron_severity: nemotron.severity,
        models_agree,
      },
      claude: {
        severity: claude.severity,
        explanation: claude.explanation,
        self_care_tips: claude.self_care_tips || [],
        emergency: claude.emergency,
        when_to_escalate: claude.when_to_escalate,
        estimated_condition: claude.estimated_condition,
        model: "Claude claude-sonnet-4-6",
      },
      nemotron: {
        severity: nemotron.severity,
        explanation: nemotron.explanation,
        estimated_condition: nemotron.estimated_condition,
        confidence: nemotron.confidence,
        model: "NVIDIA Nemotron-4-340B",
      },
      ml: {
        available: ml.ml_available !== false,
        predicted_disease: ml.predicted_disease || null,
        confidence: ml.confidence || null,
        severity_score: ml.severity_score || null,
        tier: ml.tier || null,
        top_3: ml.top_3_predictions || [],
        dataset: "DDXPlus — 1,292,579 patients, 49 diseases",
        model: "Random Forest (scikit-learn)",
      },
      models_used: ["Claude claude-sonnet-4-6", "Nemotron-4-340B", "Random Forest DDXPlus"],
      processing_time_ms: Date.now() - startTime,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
