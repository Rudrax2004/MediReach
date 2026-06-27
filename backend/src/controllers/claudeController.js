const { analyzeWithClaude } = require("../utils/claudeClient");
const logger = require("../utils/logger");

const analyze = async (patientData) => {
  const start = Date.now();

  try {
    const result = await analyzeWithClaude(patientData);

    return {
      model: "claude",
      status: "success",
      latencyMs: Date.now() - start,
      analysis: result,
    };
  } catch (error) {
    logger.error("Claude analysis failed", { error: error.message });

    return {
      model: "claude",
      status: "error",
      latencyMs: Date.now() - start,
      error: error.message,
    };
  }
};

module.exports = { analyze };
