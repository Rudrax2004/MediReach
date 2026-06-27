const OpenAI = require("openai");
const logger = require("../utils/logger");

const MODEL = "nvidia/nemotron-4-340b-instruct";
const MODEL_LABEL = "nemotron-4-340b";

const SYSTEM_PROMPT = `You are MediReach's primary clinical triage engine powered by NVIDIA Nemotron-4. Your role is to assess symptom urgency and predict the most likely condition category for patients in remote communities.

Return ONLY raw JSON, no markdown:
{
  'severity': 'green' | 'yellow' | 'red',
  'explanation': '2-3 warm, plain-language sentences explaining the assessment and likely situation.',
  'estimated_condition': 'Plain-language phrase for the most likely condition category.',
  'confidence': 'high' | 'medium' | 'low',
  'agree_note': 'One sentence about what you are most certain about.'
}

Severity rules:
GREEN: minor self-manageable symptoms
YELLOW: needs medical attention, not immediately life-threatening
RED: potentially life-threatening — chest pain, breathing difficulty, stroke signs, anaphylaxis`;

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_BASE_URL,
});

const parseJsonResponse = (text) => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
};

const logDemoVerdicts = (severity, source) => {
  console.log(
    `\n╔══════════════════════════════════════════════════════╗` +
      `\n║  MediReach — Nemotron Primary Triage                 ║` +
      `\n╠══════════════════════════════════════════════════════╣` +
      `\n║  Source:    ${(source || "nemotron").toUpperCase().padEnd(40)}║` +
      `\n║  Severity:  ${(severity || "n/a").toUpperCase().padEnd(40)}║` +
      `\n╚══════════════════════════════════════════════════════╝\n`
  );
};

const nemotronTriage = async (symptoms_text, age, sex) => {
  const start = Date.now();

  try {
    if (!process.env.NVIDIA_API_KEY) {
      throw new Error("NVIDIA_API_KEY is not configured");
    }

    const userMessage = `Patient: Age ${age}, Sex ${sex}. Reported symptoms: ${symptoms_text}. Please provide your independent triage assessment.`;

    logger.debug("Calling Nemotron triage", { model: MODEL });

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 600,
      top_p: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Nemotron returned no content");
    }

    const parsed = parseJsonResponse(content);
    logDemoVerdicts(parsed.severity, "nemotron");

    return {
      ...parsed,
      model: MODEL_LABEL,
      processing_time_ms: Date.now() - start,
    };
  } catch (error) {
    logger.error("Nemotron triage failed", { error: error.message });

    return {
      severity: "yellow",
      estimated_condition: "Unable to assess",
      model: MODEL_LABEL,
      error: true,
      processing_time_ms: Date.now() - start,
    };
  }
};

const analyze = async (patientData) => {
  const result = await nemotronTriage(
    patientData.symptoms,
    patientData.age ?? "unknown",
    patientData.sex ?? patientData.gender ?? "unknown"
  );

  if (result.error) {
    return {
      model: MODEL_LABEL,
      status: "error",
      latencyMs: result.processing_time_ms,
      analysis: result,
    };
  }

  return {
    model: MODEL_LABEL,
    status: "success",
    latencyMs: result.processing_time_ms,
    analysis: result,
  };
};

module.exports = { nemotronTriage, analyze };
