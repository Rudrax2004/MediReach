const { analyzeWithNemotron } = require("../utils/nemotronClient");
const logger = require("../utils/logger");

const analyze = async (patientData) => {
  const start = Date.now();

  try {
    const result = await analyzeWithNemotron(patientData);

    return {
      model: "nemotron",
      status: "success",
      latencyMs: Date.now() - start,
      analysis: result,
    };
  } catch (error) {
    logger.error("Nemotron analysis failed", { error: error.message });

    return {
      model: "nemotron",
      status: "error",
      latencyMs: Date.now() - start,
      error: error.message,
    };
  }
};

module.exports = { analyze };
