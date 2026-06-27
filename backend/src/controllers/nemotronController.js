const OpenAI = require("openai");
const logger = require("../utils/logger");

const MODEL = "nvidia/nemotron-4-340b-instruct";
const MODEL_LABEL = "nemotron-4-340b";

const SYSTEM_PROMPT = `You are MediReach's validation AI — a medical triage assistant providing a second opinion alongside Claude. Your role is to independently assess symptom urgency for patients in remote communities.

Return ONLY raw JSON, no markdown:
{
  'severity': 'green' | 'yellow' | 'red',
  'explanation': '1-2 sentences: your independent assessment of the situation.',
  'estimated_condition': 'Plain-language phrase for the most likely condition category.',
  'confidence': 'high' | 'medium' | 'low',
  'agree_note': 'One sentence about what you are most certain about.'
}

Severity rules — same as Claude:
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

const computeConsensus = (nemotronSeverity, claudeSeverity) => {
  if (!claudeSeverity) {
    return { consensus: "unavailable" };
  }

  if (nemotronSeverity === claudeSeverity) {
    return { consensus: "agree", confidence_boost: true };
  }

  return { consensus: "differ", use_claude: true };
};

const logDemoVerdicts = (claudeSeverity, nemotronSeverity, consensusResult) => {
  const claudeLabel = (claudeSeverity || "n/a").toUpperCase();
  const nemotronLabel = (nemotronSeverity || "n/a").toUpperCase();
  const consensusLabel = consensusResult.consensus.toUpperCase();

  console.log(
    `\n╔══════════════════════════════════════════════════════╗` +
      `\n║  MediReach Demo — AI Triage Verdicts                 ║` +
      `\n╠══════════════════════════════════════════════════════╣` +
      `\n║  Claude:    ${claudeLabel.padEnd(40)}║` +
      `\n║  Nemotron:  ${nemotronLabel.padEnd(40)}║` +
      `\n║  Consensus: ${consensusLabel.padEnd(40)}║` +
      `\n╚══════════════════════════════════════════════════════╝\n`
  );
};

const nemotronTriage = async (symptoms_text, age, sex, claude_severity) => {
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
    const consensusResult = computeConsensus(parsed.severity, claude_severity);

    logDemoVerdicts(claude_severity, parsed.severity, consensusResult);

    return {
      ...parsed,
      model: MODEL_LABEL,
      ...consensusResult,
      processing_time_ms: Date.now() - start,
    };
  } catch (error) {
    logger.error("Nemotron triage failed", { error: error.message });

    logDemoVerdicts(claude_severity, "unavailable", { consensus: "unavailable" });

    return {
      severity: "yellow",
      estimated_condition: "Unable to assess",
      consensus: "unavailable",
      model: MODEL_LABEL,
      error: true,
      processing_time_ms: Date.now() - start,
    };
  }
};

const analyze = async (patientData, claudeSeverity) => {
  const result = await nemotronTriage(
    patientData.symptoms,
    patientData.age ?? "unknown",
    patientData.sex ?? patientData.gender ?? "unknown",
    claudeSeverity
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
