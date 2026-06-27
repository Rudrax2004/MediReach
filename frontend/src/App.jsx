import { useState } from "react";
import VoiceInput from "./components/VoiceInput";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [symptomsText, setSymptomsText] = useState("");
  const [age, setAge] = useState(35);
  const [sex, setSex] = useState("M");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const runAnalyze = async (payload) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    runAnalyze({
      symptoms_text: symptomsText,
      symptom_ids: [],
      age: Number(age),
      sex,
    });
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>MediReach</h1>
        <p>AI-powered remote health triage</p>
      </header>

      <form className="app__form" onSubmit={handleManualSubmit}>
        <div className="app__row">
          <div className="app__field">
            <label htmlFor="age">Age</label>
            <input
              id="age"
              type="number"
              min="0"
              max="120"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </div>
          <div className="app__field">
            <label htmlFor="sex">Sex</label>
            <select id="sex" value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
        </div>

        <VoiceInput
          symptomsText={symptomsText}
          onSymptomsChange={setSymptomsText}
          onAnalyze={runAnalyze}
          age={Number(age)}
          sex={sex}
          symptomIds={[]}
        />

        <button type="submit" className="app__submit" disabled={loading || !symptomsText.trim()}>
          {loading ? "Analyzing..." : "Analyze Symptoms"}
        </button>
      </form>

      {error && <p className="app__error">{error}</p>}

      {results && (
        <div className="app__results">
          <pre>{JSON.stringify(results, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
