const axios = require("axios");
const logger = require("../utils/logger");

const mlPredict = async (symptom_ids, age, sex) => {
  try {
    const baseUrl = process.env.ML_API_URL;
    if (!baseUrl) {
      throw new Error("ML_API_URL is not configured");
    }

    const url = `${baseUrl.replace(/\/$/, "")}/predict`;

    logger.debug("Calling ML predict API", { url });

    const response = await axios.post(
      url,
      { symptoms: symptom_ids, age, sex },
      { timeout: 8000 }
    );

    return {
      ml_available: true,
      ...response.data,
    };
  } catch (error) {
    logger.error("ML predict failed", { error: error.message });

    return {
      ml_available: false,
      message: "ML offline — using AI guidance only",
    };
  }
};

module.exports = { mlPredict };
