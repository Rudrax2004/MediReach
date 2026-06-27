const express = require("express");
const { claudeTriage } = require("../controllers/claudeController");
const { nemotronTriage } = require("../controllers/nemotronController");
const { mlPredict } = require("../controllers/mlController");
const logger = require("../utils/logger");

const router = express.Router();

const isAiSuccess = (result) => result && !result.error && result.severity;

const isMlSuccess = (result) =>
  result && result.ml_available !== false && (result.tier || result.predicted_disease);

const nemotronToReport = (result) => ({
  severity: result.severity,
  explanation: result.explanation,
  estimated_condition: result.estimated_condition,
  confidence: result.confidence,
  self_care_tips: [],
  emergency: result.severity === "red",
  when_to_escalate:
    result.severity === "red"
      ? "Seek emergency care immediately if symptoms worsen."
      : "Contact a clinician if symptoms do not improve within 48 hours.",
});

const claudeToReport = (result) => ({
  severity: result.severity,
  explanation: result.explanation,
  estimated_condition: result.estimated_condition,
  confidence: "high",
  self_care_tips: result.self_care_tips || [],
  emergency: Boolean(result.emergency) || result.severity === "red",
  when_to_escalate: result.when_to_escalate,
});

const mlToReport = (result) => ({
  severity: result.tier || "yellow",
  explanation: `Our DDXPlus-trained Random Forest model predicts ${result.predicted_disease} (${Math.round((result.confidence || 0) * 100)}% confidence).`,
  estimated_condition: result.predicted_disease,
  confidence: result.confidence,
  self_care_tips:
    result.tier === "green"
      ? [
          "Rest and stay hydrated",
          "Monitor symptoms for 24–48 hours",
          "Contact a clinician if symptoms worsen",
        ]
      : [],
  emergency: result.tier === "red",
  when_to_escalate:
    result.tier === "red"
      ? "Seek emergency care immediately."
      : "Seek medical attention if symptoms worsen or new symptoms appear.",
});

const fallbackReport = () => ({
  severity: "yellow",
  explanation:
    "We could not complete an automated assessment. Please consult a healthcare provider.",
  estimated_condition: "Unable to assess",
  confidence: "low",
  self_care_tips: [],
  emergency: false,
  when_to_escalate: "Seek immediate care if symptoms become severe.",
});

const isClaudeConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

const buildConsensusLabel = (primarySource, claudeSkipped = false) => {
  if (primarySource === "nemotron") {
    return "✓ Assessment by NVIDIA Nemotron-4";
  }
  if (primarySource === "claude") {
    return "⚠ Nemotron unavailable — Claude assessment used";
  }
  if (primarySource === "ml") {
    if (claudeSkipped) {
      return "⚠ Nemotron unavailable — DDXPlus Random Forest model used";
    }
    return "⚠ AI unavailable — DDXPlus Random Forest model used";
  }
  return "⚠ All models unavailable — please consult a doctor";
};

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

    const trimmed = symptoms_text.trim();
    const claudeAvailable = isClaudeConfigured();
    const chainLabel = claudeAvailable ? "nemotron→claude→ml" : "nemotron→ml";
    logger.info("Starting sequential triage", {
      symptoms_text: trimmed,
      chain: chainLabel,
      claude_configured: claudeAvailable,
    });

    const startTime = Date.now();
    const fallbackChain = [];

    let nemotron = null;
    let claude = null;
    let ml = null;
    let primarySource = "none";
    let report = fallbackReport();

    nemotron = await nemotronTriage(trimmed, age, sex);
    fallbackChain.push({
      model: "nemotron",
      success: isAiSuccess(nemotron),
      latency_ms: nemotron.processing_time_ms,
    });

    if (isAiSuccess(nemotron)) {
      primarySource = "nemotron";
      report = nemotronToReport(nemotron);
      logger.info("Triage completed via Nemotron");
    } else if (claudeAvailable) {
      logger.warn("Nemotron failed, falling back to Claude");

      claude = await claudeTriage(trimmed, age, sex);
      fallbackChain.push({
        model: "claude",
        success: isAiSuccess(claude),
        latency_ms: claude.processing_time_ms,
      });

      if (isAiSuccess(claude)) {
        primarySource = "claude";
        report = claudeToReport(claude);
        logger.info("Triage completed via Claude (fallback)");
      } else {
        logger.warn("Claude failed, falling back to ML model");

        ml = await mlPredict(symptom_ids, age, sex);
        fallbackChain.push({
          model: "ml",
          success: isMlSuccess(ml),
        });

        if (isMlSuccess(ml)) {
          primarySource = "ml";
          report = mlToReport(ml);
          logger.info("Triage completed via Random Forest (fallback)");
        } else {
          logger.error("All triage models failed");
        }
      }
    } else {
      logger.warn("Nemotron failed, skipping Claude (ANTHROPIC_API_KEY not set), using ML");

      ml = await mlPredict(symptom_ids, age, sex);
      fallbackChain.push({
        model: "claude",
        success: false,
        skipped: true,
        reason: "ANTHROPIC_API_KEY not configured",
      });
      fallbackChain.push({
        model: "ml",
        success: isMlSuccess(ml),
      });

      if (isMlSuccess(ml)) {
        primarySource = "ml";
        report = mlToReport(ml);
        logger.info("Triage completed via Random Forest (fallback)");
      } else {
        logger.error("Nemotron and ML failed; Claude was not configured");
      }
    }

    console.log(
      `\n╔══════════════════════════════════════════════════════╗` +
        `\n║  MediReach — Sequential Triage                       ║` +
        `\n╠══════════════════════════════════════════════════════╣` +
        `\n║  Primary:   ${primarySource.toUpperCase().padEnd(40)}║` +
        `\n║  Severity:  ${(report.severity || "n/a").toUpperCase().padEnd(40)}║` +
        `\n║  Chain:     ${fallbackChain.map((s) => `${s.model}:${s.success ? "ok" : "fail"}`).join(" → ").padEnd(40)}║` +
        `\n╚══════════════════════════════════════════════════════╝\n`
    );

    res.json({
      final_severity: report.severity,
      primary_source: primarySource,
      fallback_chain: fallbackChain,
      report,
      consensus: {
        type: primarySource === "nemotron" ? "primary" : "fallback",
        label: buildConsensusLabel(primarySource, !claudeAvailable),
        primary_source: primarySource,
        claude_configured: claudeAvailable,
      },
      nemotron: nemotron
        ? {
            severity: nemotron.severity,
            explanation: nemotron.explanation,
            estimated_condition: nemotron.estimated_condition,
            confidence: nemotron.confidence,
            model: "NVIDIA Nemotron-4-340B",
            used: primarySource === "nemotron",
            error: Boolean(nemotron.error),
          }
        : null,
      claude: claude
        ? {
            severity: claude.severity,
            explanation: claude.explanation,
            self_care_tips: claude.self_care_tips || [],
            emergency: claude.emergency,
            when_to_escalate: claude.when_to_escalate,
            estimated_condition: claude.estimated_condition,
            model: "Claude claude-sonnet-4-6",
            used: primarySource === "claude",
            error: Boolean(claude.error),
          }
        : null,
      ml: ml
        ? {
            available: ml.ml_available !== false,
            predicted_disease: ml.predicted_disease || null,
            confidence: ml.confidence || null,
            severity_score: ml.severity_score || null,
            tier: ml.tier || null,
            top_3: ml.top_3_predictions || [],
            dataset: "DDXPlus — 1,292,579 patients, 49 diseases",
            model: "Random Forest (scikit-learn)",
            used: primarySource === "ml",
          }
        : null,
      models_used: fallbackChain.map((step) => step.model),
      processing_time_ms: Date.now() - startTime,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
