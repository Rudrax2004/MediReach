const OpenAI = require("openai");
const logger = require("./logger");

const parseJsonResponse = (text) => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
};

const NEMOTRON_MODEL = "nvidia/nemotron-3-nano-30b-a3b";

let client = null;

const getClient = () => {
  if (!process.env.NVIDIA_API_KEY) {
    throw new Error("NVIDIA_API_KEY is not configured");
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
    });
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

const analyzeWithNemotron = async (patientData) => {
  const openai = getClient();

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

  logger.debug("Calling Nemotron API", { model: NEMOTRON_MODEL });

  const response = await openai.chat.completions.create({
    model: NEMOTRON_MODEL,
    messages: [
      { role: "system", content: TRIAGE_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Nemotron returned no content");
  }

  return parseJsonResponse(content);
};

module.exports = { analyzeWithNemotron, NEMOTRON_MODEL };
