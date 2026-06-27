const Anthropic = require("@anthropic-ai/sdk");
const logger = require("../utils/logger");

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are MediReach's primary clinical triage engine. You work alongside NVIDIA Nemotron-4 and a trained Random Forest ML model. Your role is to assess symptom urgency for patients in remote and underserved communities worldwide.

Return ONLY raw JSON, no markdown, no preamble:
{
  'severity': 'green' | 'yellow' | 'red',
  'explanation': '2-3 warm, plain-language sentences. Acknowledge the patient's concern, explain the likely situation, and justify your severity tier. Write as if speaking to a worried patient in a remote community.',
  'self_care_tips': ['tip 1', 'tip 2', 'tip 3'],
  'should_book': true | false,
  'emergency': true | false,
  'when_to_escalate': 'One sentence: the exact warning signs that mean seek emergency care immediately.',
  'estimated_condition': 'Plain-language phrase for the likely condition category (e.g. upper respiratory infection, cardiac event)'
}

Severity rules:
GREEN — minor, self-manageable: cold, mild headache, minor indigestion, low-grade fever
YELLOW — needs medical attention within 24-48h, not immediately life-threatening
RED — potentially life-threatening: chest pain, breathing difficulty, stroke signs, anaphylaxis, severe injury, high fever in infant

Always: be cautious, escalate when uncertain, Grade 8 reading level, culturally sensitive.
Never: diagnose specific diseases, use unexplained jargon, dismiss symptoms.`;

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

const parseJsonResponse = (text) => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
};

const claudeTriage = async (symptoms_text, age, sex) => {
  const start = Date.now();

  try {
    const anthropic = getClient();
    const userMessage = `Age: ${age}, Sex: ${sex}. Symptoms: ${symptoms_text}`;

    logger.debug("Calling Claude triage", { model: MODEL });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock) {
      throw new Error("Claude returned no text content");
    }

    const parsed = parseJsonResponse(textBlock.text);

    return {
      ...parsed,
      model: MODEL,
      processing_time_ms: Date.now() - start,
    };
  } catch (error) {
    logger.error("Claude triage failed", { error: error.message });

    return {
      severity: "yellow",
      explanation: "Unable to process — please consult a doctor.",
      emergency: false,
      model: MODEL,
      error: true,
      processing_time_ms: Date.now() - start,
    };
  }
};

const analyze = async (patientData) => {
  const result = await claudeTriage(
    patientData.symptoms,
    patientData.age ?? "unknown",
    patientData.sex ?? patientData.gender ?? "unknown"
  );

  if (result.error) {
    return {
      model: MODEL,
      status: "error",
      latencyMs: result.processing_time_ms,
      analysis: result,
    };
  }

  return {
    model: MODEL,
    status: "success",
    latencyMs: result.processing_time_ms,
    analysis: result,
  };
};

module.exports = { claudeTriage, analyze };
