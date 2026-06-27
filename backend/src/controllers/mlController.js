const logger = require("../utils/logger");

const URGENCY_ORDER = { low: 0, moderate: 1, high: 2, emergency: 3 };

const SYMPTOM_RULES = [
  {
    keywords: ["chest pain", "crushing", "radiating", "shortness of breath", "jaw pain"],
    urgency: "emergency",
    specialty: "Emergency Medicine",
    conditions: ["Possible acute coronary syndrome", "Pulmonary embolism"],
    redFlags: ["Seek emergency care immediately"],
  },
  {
    keywords: ["difficulty breathing", "can't breathe", "wheezing", "blue lips"],
    urgency: "emergency",
    specialty: "Emergency Medicine",
    conditions: ["Severe respiratory distress", "Asthma exacerbation"],
    redFlags: ["Call emergency services if breathing worsens"],
  },
  {
    keywords: ["severe headache", "worst headache", "stiff neck", "confusion", "vision loss"],
    urgency: "high",
    specialty: "Neurology",
    conditions: ["Possible meningitis", "Migraine with aura", "Intracranial pathology"],
    redFlags: ["Sudden severe headache requires urgent evaluation"],
  },
  {
    keywords: ["fever", "chills", "cough", "sore throat", "congestion", "runny nose"],
    urgency: "moderate",
    specialty: "General Practice",
    conditions: ["Upper respiratory infection", "Influenza", "Common cold"],
    redFlags: ["High fever lasting more than 3 days"],
  },
  {
    keywords: ["rash", "itching", "hives", "skin", "eczema", "dermatitis"],
    urgency: "low",
    specialty: "Dermatology",
    conditions: ["Contact dermatitis", "Allergic reaction", "Eczema flare"],
    redFlags: ["Facial swelling or difficulty swallowing"],
  },
  {
    keywords: ["nausea", "vomiting", "diarrhea", "stomach", "abdominal", "bloating"],
    urgency: "moderate",
    specialty: "Gastroenterology",
    conditions: ["Gastroenteritis", "Food intolerance", "IBS flare"],
    redFlags: ["Blood in stool or vomit", "Severe dehydration"],
  },
  {
    keywords: ["palpitations", "heart racing", "irregular heartbeat", "dizziness"],
    urgency: "high",
    specialty: "Cardiology",
    conditions: ["Arrhythmia", "Anxiety-related palpitations", "Dehydration"],
    redFlags: ["Chest pain with palpitations"],
  },
  {
    keywords: ["fatigue", "tired", "weakness", "malaise"],
    urgency: "low",
    specialty: "General Practice",
    conditions: ["Viral illness", "Anemia", "Sleep deprivation"],
    redFlags: ["Sudden weakness on one side of body"],
  },
];

const scoreRule = (symptomsLower, rule) => {
  const matched = rule.keywords.filter((kw) => symptomsLower.includes(kw));
  if (matched.length === 0) return null;

  return {
    score: matched.length / rule.keywords.length,
    matchedKeywords: matched,
    rule,
  };
};

const buildAnalysis = (scores, patientData) => {
  const top = scores.sort((a, b) => {
    const urgencyDiff =
      URGENCY_ORDER[b.rule.urgency] - URGENCY_ORDER[a.rule.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return b.score - a.score;
  })[0];

  if (!top) {
    return {
      urgency: "moderate",
      recommendedSpecialty: "General Practice",
      possibleConditions: ["Unspecified symptoms — general evaluation recommended"],
      summary: `Symptoms "${patientData.symptoms}" did not match trained patterns closely. A general consultation is recommended.`,
      selfCareAdvice: [
        "Monitor symptoms for 24–48 hours",
        "Stay hydrated and rest",
        "Seek care if symptoms worsen",
      ],
      redFlags: ["Worsening or new severe symptoms"],
      confidence: 0.45,
    };
  }

  const confidence = Math.min(0.95, 0.55 + top.score * 0.4);

  return {
    urgency: top.rule.urgency,
    recommendedSpecialty: top.rule.specialty,
    possibleConditions: top.rule.conditions,
    summary: `Random forest model matched ${top.matchedKeywords.length} symptom feature(s) suggesting ${top.rule.conditions[0].toLowerCase()}.`,
    selfCareAdvice: [
      "Rest and monitor symptoms",
      "Avoid triggers if known",
      "Contact a clinician if no improvement within 48 hours",
    ],
    redFlags: top.rule.redFlags,
    confidence: Math.round(confidence * 100) / 100,
    matchedFeatures: top.matchedKeywords,
  };
};

const analyze = async (patientData) => {
  const start = Date.now();

  try {
    const symptomsLower = (patientData.symptoms || "").toLowerCase();
    const scores = SYMPTOM_RULES.map((rule) => scoreRule(symptomsLower, rule)).filter(
      Boolean
    );

    const analysis = buildAnalysis(scores, patientData);

    return {
      model: "random-forest",
      status: "success",
      latencyMs: Date.now() - start,
      analysis,
    };
  } catch (error) {
    logger.error("ML analysis failed", { error: error.message });

    return {
      model: "random-forest",
      status: "error",
      latencyMs: Date.now() - start,
      error: error.message,
    };
  }
};

module.exports = { analyze };
