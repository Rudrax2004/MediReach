const Anthropic = require("@anthropic-ai/sdk");
const logger = require("./logger");

const parseJsonResponse = (text) => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
};

let client = null;

const getClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  return client;
};

const TRIAGE_SYSTEM_PROMPT = `You are MediReach, a clinical triage assistant for remote telehealth.
Analyze patient symptoms and respond ONLY with valid JSON (no markdown fences) using this schema:
{
  "urgency": "low" | "moderate" | "high" | "emergency",
  "recommendedSpecialty": string,
  "possibleConditions": string[],
  "summary": string,
  "selfCareAdvice": string[],
  "redFlags": string[],
  "confidence": number
}
Be cautious, never diagnose definitively, and recommend emergency care when appropriate.`;

const analyzeWithClaude = async (patientData) => {
  const anthropic = getClient();

  const userMessage = [
    `Symptoms: ${patientData.symptoms}`,
    patientData.age != null ? `Age: ${patientData.age}` : null,
    patientData.gender ? `Gender: ${patientData.gender}` : null,
    patientData.duration ? `Duration: ${patientData.duration}` : null,
    patientData.severity ? `Severity: ${patientData.severity}` : null,
    patientData.medicalHistory?.length
      ? `Medical history: ${patientData.medicalHistory.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  logger.debug("Calling Claude API", { model: "claude-sonnet-4-20250514" });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: TRIAGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("Claude returned no text content");
  }

  return parseJsonResponse(textBlock.text);
};

module.exports = { analyzeWithClaude, TRIAGE_SYSTEM_PROMPT };
