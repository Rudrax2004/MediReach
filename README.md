<p align="center">
  <img src="https://img.shields.io/badge/MediReach-AI%20Health%20Triage-0F6E56?style=for-the-badge" alt="MediReach"/>
</p>

<h1 align="center">MediReach — AI-Powered Health Triage & Telehealth</h1>

<p align="center">
  <em>Healthcare that reaches you — no matter the weather</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Built%20At-Cursor%20Hackathon%20Sudbury%202026-blue?style=flat-square"/>
  <img src="https://img.shields.io/badge/AI-NVIDIA%20Nemotron--4--340B-76B900?style=flat-square&logo=nvidia"/>
  <img src="https://img.shields.io/badge/ML-scikit--learn-F7931E?style=flat-square&logo=scikit-learn"/>
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20TailwindCSS-61DAFB?style=flat-square&logo=react"/>
  <img src="https://img.shields.io/badge/Dataset-DDXPlus%201.29M%20Records-green?style=flat-square"/>
</p>

<p align="center">
  <a href="https://medireachai.lovable.app"><strong>🌐 Live Demo</strong></a> &nbsp;·&nbsp;
  <a href="https://github.com/Rudrax2004/MediReach"><strong>📦 GitHub</strong></a>
</p>

---

## The Problem

Northern Ontario is facing a critical healthcare crisis:

- **350+ physician vacancies** across Northern Ontario — including 200+ family doctors *(NOSM University)*
- **2.5 million Ontarians** currently have no access to a family physician *(OMA, Dec 2025)*
- **Half of Northern Ontario's doctors** are expected to retire within the next five years
- In winter, roads close for days — and the nearest ER can be hours away

This is not just a Northern Ontario problem. **4.6 billion people worldwide** lack access to essential healthcare services.

---

## The Solution

MediReach is an AI-powered health triage and telehealth platform that guides patients to the right level of care — without requiring a hospital visit.

### Three-Tier Triage System

| Tier | Color | What it means | Action |
|---|---|---|---|
| Self-care | 🟢 Green | Minor, manageable at home | Plain-language home treatment tips |
| Teleconsult | 🟡 Yellow | Needs medical attention, not urgent | Book a video appointment with a physician |
| Emergency | 🔴 Red | Potentially life-threatening | Go to ER immediately — call 911 |

Patients describe symptoms by **typing or speaking** — the AI analyzes them in seconds and returns a clear, plain-language verdict.

---

## Features

- 🤖 **AI Triage** — NVIDIA Nemotron-4-340B analyzes symptoms and returns structured severity assessment
- 🧠 **ML Disease Prediction** — Random Forest model trained on 1.29M patient records predicts the most likely condition with confidence score
- 🎤 **Voice Input** — Web Speech API lets patients speak symptoms instead of typing — critical for elderly and low-tech users
- 📅 **Teleconsult Booking** — Browse available physicians and book a video appointment in under 30 seconds
- 🏥 **Patient Profile (Phase 2)** — Unified health record mockup showing the future vision
- 📱 **Mobile Responsive** — Works on any device, any screen size

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TailwindCSS |
| Published via | Lovable |
| AI Triage | NVIDIA Nemotron-4-340B (NVIDIA Developer Program) |
| ML Model | Random Forest — scikit-learn |
| Dataset | DDXPlus — 1,292,579 patients, 49 diseases, 110 symptoms |
| Voice Input | Web Speech API |
| Physician Data | Apify Web Scraper |
| Built with | Cursor AI-assisted coding |

---

## Dataset — DDXPlus Clinical Dataset

The ML model is trained on the **DDXPlus dataset** — one of the most comprehensive open clinical AI datasets available.

| File | Rows | Description |
|---|---|---|
| `patients.csv` | 1,292,579 | Patient records: age, sex, symptoms, ground truth disease |
| `symptoms.csv` | 110 | Clinical symptom definitions with IDs |
| `diseases.csv` | 49 | Disease definitions with ICD-10 codes and severity ratings (1–5) |
| `antecedents.csv` | 113 | Medical history questions |
| `evidence_values.csv` | 764 | Multi-choice symptom possible values |

**49 diseases** including URTI, Pneumonia, Influenza, Anaphylaxis, Pulmonary Embolism, NSTEMI, Panic Attack, Tuberculosis, GERD, Cluster Headache, Bronchitis, and more.

**Severity scale:** 1 = Critical emergency → 5 = Mild (maps directly to Red / Yellow / Green triage tiers)

> Dataset source: [DDXPlus on Kaggle](https://www.kaggle.com/datasets/ddxplus)

---

## ML Model

### Architecture
- **Model:** Random Forest Classifier (scikit-learn)
- **Training samples:** 100,000 (sampled from 1.29M, `random_state=42`)
- **Features:** 112 — binary symptom presence matrix (110 symptoms) + age + sex
- **Classes:** 49 diseases
- **Class weighting:** Balanced (handles class imbalance)

### Training Pipeline

Run scripts in this exact order:

```bash
cd ml

# Install dependencies
pip install -r requirements.txt

# Step 1 — Explore and clean data
python scripts/preprocess.py

# Step 2 — Build feature matrix
python scripts/feature_engineer.py

# Step 3 — Train model (3–5 minutes)
python scripts/train.py

# Step 4 — Start prediction API (keep running during demo)
python scripts/predict_api.py
```

The Flask prediction API runs on `http://localhost:5001` and accepts:
```json
POST /predict
{ "symptoms": ["E_91", "E_55"], "age": 35, "sex": "M" }
```

Returns:
```json
{
  "predicted_disease": "Upper Respiratory Tract Infection",
  "severity_score": 5,
  "tier": "green",
  "confidence": 0.81,
  "top_3_predictions": [
    { "disease": "URTI", "probability": 0.81 },
    { "disease": "Common Cold", "probability": 0.12 },
    { "disease": "Influenza", "probability": 0.07 }
  ]
}
```

---

## Project Structure

```
medireach-ai/
├── frontend/                   ← React app (Lovable export)
│   ├── src/
│   │   ├── api/
│   │   │   └── triageService.js   ← Nemotron API calls
│   │   ├── components/
│   │   │   ├── SymptomChecker.jsx
│   │   │   ├── ResultsPanel.jsx
│   │   │   └── VoiceInput.jsx
│   │   └── pages/
│   │       ├── Home.jsx
│   │       ├── Symptoms.jsx
│   │       ├── Book.jsx
│   │       └── Profile.jsx
├── backend/                    ← Node.js Express API
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   └── utils/
│   └── data/
│       ├── doctors.json        ← Apify scraped physician data
│       └── appointments.json
├── ml/                         ← Machine Learning pipeline
│   ├── scripts/
│   │   ├── preprocess.py
│   │   ├── feature_engineer.py
│   │   ├── train.py
│   │   └── predict_api.py
│   ├── models/                 ← Saved model artifacts
│   │   ├── medireach_model.pkl
│   │   ├── feature_columns.pkl
│   │   ├── severity_map.pkl
│   │   └── metrics.json
│   ├── data/
│   └── requirements.txt
└── data/
    └── raw/                    ← DDXPlus CSV files
```

---

## Setup & Run Locally

### Prerequisites
- Node.js 18+
- Python 3.10+
- Chrome (for voice input)

### 1. Clone the repo
```bash
git clone https://github.com/Rudrax2004/MediReach.git
cd MediReach
```

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Add VITE_NVIDIA_API_KEY to .env
npm run dev
```

### 3. Backend
```bash
cd backend
npm install
cp .env.example .env
# Add NVIDIA_API_KEY to .env
npm run dev
```

### 4. ML Model
```bash
cd ml
pip install -r requirements.txt
python scripts/preprocess.py
python scripts/feature_engineer.py
python scripts/train.py
python scripts/predict_api.py   # Keep running on port 5001
```

### Environment Variables

```env
# Frontend (.env)
VITE_NVIDIA_API_KEY=your_nvidia_key_from_build.nvidia.com

# Backend (.env)
PORT=3001
NVIDIA_API_KEY=your_nvidia_key
ML_API_URL=http://localhost:5001
```

> Get your free NVIDIA API key at [build.nvidia.com](https://build.nvidia.com) — no credit card required.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/analyze` | Main triage — calls Nemotron + ML model |
| `GET` | `/api/doctors` | List available physicians |
| `POST` | `/api/book-appointment` | Book a teleconsult |
| `GET` | `/api/appointments` | List all appointments |
| `GET` | `/health` | Server health check |

---

## Roadmap — Phase 2

- [ ] Unified patient health record — MRI, X-rays, lab reports, medications in one place
- [ ] Real physician integration — live availability from Northern Ontario clinics
- [ ] Multilingual support — Indigenous languages, French, and newcomer communities
- [ ] Offline-first mobile app — for communities with limited connectivity
- [ ] Integration with Ontario Health811 and the $2.1B Primary Care Action Plan

---

## Built At

**Cursor Hackathon Sudbury 2026**
Track: Healthcare & Community Wellbeing
Duration: 6 hours

---

## Author

**Rudy** — Masters Student, Computational Science
Laurentian University, Sudbury, Ontario

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0077B5?style=flat-square&logo=linkedin)](https://linkedin.com/in/rudrax-prajapati-40b77a226)
[![GitHub](https://img.shields.io/badge/GitHub-Rudrax2004-181717?style=flat-square&logo=github)](https://github.com/Rudrax2004)

---

## Disclaimer

MediReach provides general health guidance only and is **not a substitute for professional medical advice**. Always consult a qualified healthcare provider for medical decisions. Built for demonstration purposes.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <em>MediReach — Healthcare that reaches you, no matter where you are.</em>
</p>
