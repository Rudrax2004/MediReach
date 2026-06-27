import "./TriageResults.css";

const TIER_CONFIG = {
  green: {
    label: "Self-Care Recommended",
    badge: "GREEN",
    className: "triage-results--green",
  },
  yellow: {
    label: "Medical Attention Needed",
    badge: "YELLOW",
    className: "triage-results--yellow",
  },
  red: {
    label: "Emergency",
    badge: "RED",
    className: "triage-results--red",
  },
};

export default function TriageResults({ results, loading }) {
  if (loading) {
    return (
      <div className="triage-results triage-results--loading">
        <div className="triage-results__spinner" />
        <p className="triage-results__loading-text">
          Sending to Claude &amp; Nemotron for analysis...
        </p>
      </div>
    );
  }

  if (!results) return null;

  const tier = results.final_severity || "yellow";
  const config = TIER_CONFIG[tier] || TIER_CONFIG.yellow;
  const isEmergency = tier === "red" || results.claude?.emergency;

  return (
    <div className={`triage-results ${config.className}`}>
      {isEmergency && (
        <div className="triage-results__emergency-banner" role="alert">
          <span className="triage-results__emergency-icon">🚨</span>
          <div>
            <strong>Call 911 immediately</strong>
            <p>This may be life-threatening. Do not wait for your appointment.</p>
          </div>
        </div>
      )}

      <div className="triage-results__header">
        <span className="triage-results__badge">{config.badge}</span>
        <h2>{config.label}</h2>
        {results.processing_time_ms != null && (
          <span className="triage-results__timing">
            {results.processing_time_ms}ms
          </span>
        )}
      </div>

      {results.consensus && (
        <p className="triage-results__consensus">{results.consensus.label}</p>
      )}

      {results.claude?.explanation && (
        <div className="triage-results__section">
          <h3>What this means</h3>
          <p>{results.claude.explanation}</p>
        </div>
      )}

      {tier === "green" && results.claude?.self_care_tips?.length > 0 && (
        <div className="triage-results__section">
          <h3>Home treatment guidance</h3>
          <ul className="triage-results__tips">
            {results.claude.self_care_tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {results.claude?.when_to_escalate && (
        <div className="triage-results__escalate">
          <strong>Seek help immediately if:</strong> {results.claude.when_to_escalate}
        </div>
      )}

      {results.claude?.estimated_condition && (
        <p className="triage-results__condition">
          Likely category: {results.claude.estimated_condition}
        </p>
      )}

      <div className="triage-results__models">
        <span>Claude: {results.claude?.severity}</span>
        <span>Nemotron: {results.nemotron?.severity}</span>
        {results.ml?.available && (
          <span>ML: {results.ml.tier || results.ml.predicted_disease}</span>
        )}
      </div>
    </div>
  );
}
