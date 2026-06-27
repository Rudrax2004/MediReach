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

const SOURCE_LABELS = {
  nemotron: "NVIDIA Nemotron-4",
  claude: "Claude claude-sonnet-4-6",
  ml: "Random Forest (DDXPlus)",
  none: "Unavailable",
};

export default function TriageResults({ results, loading }) {
  if (loading) {
    return (
      <div className="triage-results triage-results--loading">
        <div className="triage-results__spinner" />
        <p className="triage-results__loading-text">
          Analyzing with NVIDIA Nemotron...
        </p>
      </div>
    );
  }

  if (!results) return null;

  const report = results.report || {};
  const tier = results.final_severity || report.severity || "yellow";
  const config = TIER_CONFIG[tier] || TIER_CONFIG.yellow;
  const isEmergency = report.emergency || tier === "red";
  const selfCareTips =
    report.self_care_tips?.length > 0
      ? report.self_care_tips
      : results.claude?.self_care_tips || [];

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

      {results.primary_source && (
        <p className="triage-results__source">
          Powered by {SOURCE_LABELS[results.primary_source] || results.primary_source}
        </p>
      )}

      {results.consensus && (
        <p className="triage-results__consensus">{results.consensus.label}</p>
      )}

      {(report.explanation || results.claude?.explanation) && (
        <div className="triage-results__section">
          <h3>What this means</h3>
          <p>{report.explanation || results.claude.explanation}</p>
        </div>
      )}

      {tier === "green" && selfCareTips.length > 0 && (
        <div className="triage-results__section">
          <h3>Home treatment guidance</h3>
          <ul className="triage-results__tips">
            {selfCareTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {(report.when_to_escalate || results.claude?.when_to_escalate) && (
        <div className="triage-results__escalate">
          <strong>Seek help immediately if:</strong>{" "}
          {report.when_to_escalate || results.claude.when_to_escalate}
        </div>
      )}

      {(report.estimated_condition || results.claude?.estimated_condition) && (
        <p className="triage-results__condition">
          Likely category:{" "}
          {report.estimated_condition || results.claude.estimated_condition}
        </p>
      )}

      {results.fallback_chain?.length > 1 && (
        <p className="triage-results__chain">
          Fallback chain:{" "}
          {results.fallback_chain
            .map((step) => `${step.model} (${step.success ? "ok" : "failed"})`)
            .join(" → ")}
        </p>
      )}

      <div className="triage-results__models">
        {results.nemotron && (
          <span>
            Nemotron: {results.nemotron.severity}
            {results.nemotron.used ? " ✓" : ""}
          </span>
        )}
        {results.claude && (
          <span>
            Claude: {results.claude.severity}
            {results.claude.used ? " ✓" : ""}
          </span>
        )}
        {results.ml?.available && (
          <span>
            ML: {results.ml.tier || results.ml.predicted_disease}
            {results.ml.used ? " ✓" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
