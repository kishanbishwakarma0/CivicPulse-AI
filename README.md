# CivicPulse AI

> **Reporting a civic issue is easy. Proving it was actually fixed is the problem.**

CivicPulse AI is an end-to-end AI-powered civic infrastructure intelligence platform designed to detect road damage, estimate visual severity, prioritize issues, identify duplicate reports, verify claimed resolutions, detect reopened/persistent issues, and surface geographic risk hotspots.

The project is designed as a technical prototype using computer vision, image embeddings, rule-based scoring, geospatial clustering, a FastAPI backend, a Next.js frontend, and Supabase PostgreSQL/storage.

---

## Why CivicPulse?

Traditional civic complaint systems mainly answer:

**“Was an issue reported?”**

CivicPulse goes further:

- What type of damage is visible?
- How significant does it appear visually?
- Which issues should be prioritized?
- Is this report a duplicate of an existing issue?
- Did the authority actually fix the reported damage?
- Did a previously resolved issue reappear?
- Where are multiple high-risk issues concentrated?

This creates a workflow around **detection → prioritization → resolution verification → persistence intelligence**, rather than simple complaint submission.

---

## Core Capabilities

### 1. AI Road-Damage Detection

CivicPulse uses a YOLO11n-based object detection model trained/fine-tuned on the RDD2022 road-damage dataset.

Current damage classes:

| Class | Description |
|---|---|
| Longitudinal Crack | Crack running predominantly along the road direction |
| Transverse Crack | Crack running predominantly across the road direction |
| Alligator Crack | Interconnected fatigue cracking |
| Pothole | Localized pavement depression/breakdown |

The model returns:

- Damage type
- Detection confidence
- Bounding box
- Estimated affected image area

### 2. Visual Severity Estimation

Severity is currently implemented as an **AI-assisted visual heuristic** based primarily on detected damage type and affected image area.

Levels:

- Low
- Moderate
- High

This is intentionally not presented as engineering-grade pavement severity classification. RDD2022 does not provide the engineering measurements required to reproduce standards-based severity assessment such as crack width or pothole depth.

### 3. Priority Scoring

CivicPulse converts visual signals into a priority score from **0–100**.

The current scoring function combines:

- Visual severity
- Damage-type weighting
- Estimated affected area
- Detection confidence

Priority levels:

- Low
- Medium
- High
- Critical

The current priority system is a transparent design heuristic, not a learned model or municipal policy standard.

### 4. Duplicate Issue Detection

CivicPulse uses CLIP image embeddings and cosine similarity to compare a newly submitted image with existing issue images.

The system can classify a report as:

- **Duplicate**
- **Related**
- **New Issue**

The current similarity thresholds are provisional and were calibrated from an internal 100-pair similarity distribution. They should be recalibrated with a larger labeled duplicate/non-duplicate dataset before production deployment.

### 5. Resolution Verification

One of CivicPulse's main differentiators is **AI-assisted resolution verification**.

When an authority marks an issue as resolved, a resolution image can be uploaded.

The system:

1. Re-analyzes the original issue image.
2. Analyzes the submitted resolution image.
3. Checks whether the images appear to represent the same scene.
4. Compares detected damage and affected area.
5. Estimates the percentage reduction in detected damage.
6. Produces a verification status.

Possible outcomes include:

- AI Verified
- Partially Resolved
- Not Resolved
- Inconclusive

A scene-similarity gate is used to reduce false verification from unrelated images.

The current scene-similarity threshold is **provisional** and requires calibration on a larger labeled before/after dataset.

### 6. Persistent / Reopened Issues

CivicPulse tracks issues that were previously resolved and subsequently reported again at the same location/scene.

A new report can be linked to the previous resolved issue using:

- Image similarity
- Damage type
- Existing issue status
- Location/scene information

The dashboard exposes the relationship through a **Reopened** persistence status, previous issue ID, and reopening timestamp.

This enables the system to distinguish a recurring infrastructure problem from an isolated complaint.

### 7. Geographic Risk Hotspots

Issues containing GPS coordinates are clustered using geographic distance.

CivicPulse identifies areas containing multiple nearby issues and calculates a risk score using the priority scores of clustered issues and a cluster-size adjustment.

The dashboard displays:

- Hotspot number
- Cluster size
- Risk score
- Risk level
- Cluster center
- Nearby issue details
- Map visualization

This creates a city-level **risk intelligence layer** rather than treating every complaint independently.

---

## End-to-End Workflow

```text
Citizen
   │
   ├── Upload image
   ├── Add description
   └── Capture GPS location
            │
            ▼
      FastAPI Backend
            │
            ▼
      YOLO11n Detection
            │
            ├── Damage Type
            ├── Confidence
            └── Area
            │
            ▼
    Severity Heuristic
            │
            ▼
     Priority Scoring
            │
            ├───────────────┐
            ▼               ▼
   CLIP Duplicate      Supabase Storage
     Detection               │
            │                │
            └───────┬────────┘
                    ▼
             Authority Dashboard
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   Status Workflow      Resolution Upload
 Reported → In Progress       │
        → Resolved            ▼
                       Scene Matching
                              │
                              ▼
                     Resolution Verification
                              │
                              ▼
                 Verified / Partial / Not Resolved
                              │
                              ▼
                    Future Report Analysis
                              │
                              ▼
                    Persistent / Reopened
```

---

## System Architecture

```text
┌───────────────────────────────┐
│       Next.js Frontend        │
│  Citizen Portal + Dashboard  │
└───────────────┬───────────────┘
                │ REST API
                ▼
┌───────────────────────────────┐
│          FastAPI              │
│       Backend Services        │
├───────────────────────────────┤
│ Detection                     │
│ Severity                      │
│ Priority                      │
│ Duplicate Detection           │
│ Resolution Verification       │
│ Persistence Detection         │
└───────────────┬───────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌──────────────┐  ┌────────────────┐
│ ML Models    │  │    Supabase    │
│ YOLO11n      │  │ PostgreSQL     │
│ CLIP         │  │ Storage        │
└──────────────┘  └────────────────┘
                         │
                         ▼
                  Issue Records
                  + Embeddings
                  + Resolution Data
```

---

## Machine Learning

### Road-Damage Detector

**Base model:** YOLO11n

**Training dataset:** RDD2022

**Training configuration used for the current baseline:**

- Epochs: 50
- Image size: 640
- Batch size: 16
- Device: NVIDIA Tesla T4
- Dataset classes: 4

### Independent Test Results

The current baseline was evaluated on the RDD2022 test split.

| Metric | Result |
|---|---:|
| Precision | **0.627** |
| Recall | **0.590** |
| mAP@50 | **0.611** |
| mAP@50–95 | **0.335** |

### Class-wise Test Results

| Damage Type | Precision | Recall | mAP@50 | mAP@50–95 |
|---|---:|---:|---:|---:|
| Longitudinal Crack | 0.620 | 0.524 | 0.553 | 0.303 |
| Transverse Crack | 0.554 | 0.519 | 0.521 | 0.257 |
| Alligator Crack | 0.679 | 0.591 | 0.638 | 0.331 |
| Pothole | 0.653 | 0.725 | 0.731 | 0.449 |
| **Overall** | **0.627** | **0.590** | **0.611** | **0.335** |

The results indicate that pothole detection is currently the strongest class, while transverse cracking is comparatively difficult for the baseline model.

No accuracy/F1 claim is made here because object detection performance is more appropriately reported using precision, recall, and mAP.

---

## Duplicate Detection Methodology

CivicPulse uses:

```text
Image
  ↓
CLIP Vision Encoder
  ↓
512-dimensional embedding
  ↓
L2 normalization
  ↓
Cosine similarity
  ↓
Duplicate / Related / New Issue
```

The current prototype uses provisional decision thresholds:

```text
Similarity ≥ 0.82 + same damage type → Duplicate
Similarity ≥ 0.70                  → Related
Otherwise                          → New Issue
```

These thresholds are engineering thresholds for the prototype, not a statistically validated production classifier.

---

## Resolution Verification Methodology

The resolution verifier compares a before image with an after image.

A simplified version of the decision process is:

```text
Before Image ──┐
               ├── Scene Similarity Gate
After Image ───┘
                      │
                      ▼
                Same Scene?
                 /       \
               No         Yes
               │           │
               ▼           ▼
          Inconclusive   Detection Comparison
                              │
                              ▼
                       Area Reduction
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
             ≥ 70%         ≥ 30%       < 30%
                 │            │            │
                 ▼            ▼            ▼
           AI Verified    Partially     Not Resolved
                          Resolved
```

The prototype was tested with:

- The same unchanged image → **Not Resolved**
- A synthetic repaired version → **AI Verified**, with **100% detected-area reduction** in that test

The synthetic repair test demonstrates pipeline behavior; it should not be interpreted as real-world resolution accuracy.

---

## Persistence Detection

The persistence workflow connects a new report to a previously resolved issue when the system finds sufficient evidence of similarity.

Example lifecycle:

```text
Issue #A
Reported
   ↓
In Progress
   ↓
Resolved
   ↓
AI Verified
   ↓
New similar report
   ↓
Linked to Issue #A
   ↓
Reopened / Persistent Issue
```

The database stores:

- `persistence_status`
- `related_issue_id`
- `reopened_at`

This allows the dashboard to expose recurring infrastructure problems.

---

## Risk Intelligence

GPS-enabled issues can be grouped into geographic clusters.

The prototype currently uses a ~500 m neighborhood concept for hotspot discovery and applies a cluster-size adjustment to the average priority score.

Conceptually:

```text
Risk Score =
average priority score
×
cluster-size adjustment
```

The result is capped at 100.

Risk levels:

| Score | Level |
|---:|---|
| 75–100 | Critical |
| 55–74.99 | High |
| 35–54.99 | Medium |
| < 35 | Low |

These thresholds are prototype design choices and are not municipal risk standards.

---

## Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts
- Leaflet
- React Leaflet

### Backend

- Python
- FastAPI
- Pydantic
- Uvicorn

### Machine Learning

- Ultralytics YOLO
- YOLO11n
- PyTorch
- OpenCV
- Hugging Face Transformers
- CLIP
- Scikit-learn-compatible numerical workflow where applicable

### Database & Storage

- Supabase PostgreSQL
- Supabase Storage

### Maps

- Leaflet
- OpenStreetMap

### Development

- Git
- GitHub
- Kaggle GPU environment for model training

---

## Project Structure

```text
CivicPulse-AI/
│
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── test_detector.py
│   ├── models/
│   │   └── CivicPulse-YOLO11n-baseline-best.pt
│   └── services/
│       ├── detector.py
│       ├── duplicate.py
│       ├── priority.py
│       └── severity.py
│
├── data/
│   ├── test.jpg
│   └── test_after_repair.jpg
│
├── frontend/
│   ├── app/
│   │   ├── dashboard/
│   │   └── page.tsx
│   └── components/
│       ├── IssueMap.tsx
│       └── RiskHotspots.tsx
│
├── ml/
│   └── data.yml
│
├── .gitignore
└── README.md
```

> The trained model and raw dataset are intentionally excluded from Git history. The `.gitignore` also excludes environment secrets, raw/processed datasets, model binaries, build artifacts, and dependency directories.

---

## Local Setup

### Prerequisites

- Python 3.13 recommended for the current ML environment
- Node.js
- npm
- Git
- A Supabase project
- RDD2022 dataset/model assets as required by the backend

### 1. Clone

```bash
git clone https://github.com/kishanbishwakarma0/CivicPulse-AI.git
cd CivicPulse-AI
```

### 2. Backend environment

Create and activate the Python virtual environment:

```cmd
python -m venv .venv
call .venv\Scripts\activate
```

Install backend dependencies required by the current implementation.

### 3. Environment variables

Create a root `.env` file:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SECRET_KEY=your_backend_only_secret_key
```

Never expose the Supabase secret key in the frontend or commit `.env` to Git.

### 4. Frontend environment

Create:

```text
frontend/.env.local
```

with:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### 5. Run backend

From `backend/`:

```cmd
uvicorn main:app --reload
```

Backend API:

```text
http://127.0.0.1:8000
```

Health check:

```text
GET /api/health
```

FastAPI interactive documentation:

```text
http://127.0.0.1:8000/docs
```

### 6. Run frontend

From `frontend/`:

```cmd
npm install
npm run dev
```

Frontend:

```text
http://localhost:3000
```

Authority dashboard:

```text
http://localhost:3000/dashboard
```

---

## Database

The application stores issue information including:

- Damage type
- Confidence
- Estimated affected area
- Severity
- Priority score
- Priority level
- GPS coordinates
- Description/location
- Issue status
- Resolution image information
- Verification result
- Duplicate relationship
- Image embedding
- Persistence relationship

Supabase Storage is configured with a private `issue-images` bucket in the current development setup.

---

## API Overview

The backend exposes functionality for:

```text
GET  /api/health
GET  /api/issues

POST /api/issues/analyze

PATCH /api/issues/{issue_id}/status
POST  /api/issues/{issue_id}/verify-resolution
```

The exact request/response schema can be explored through FastAPI Swagger at:

```text
http://127.0.0.1:8000/docs
```

---

## Evaluation & Testing

The project currently includes testing across several layers:

### Model

- Validation evaluation
- Independent test evaluation
- Class-wise detection metrics
- Prediction visualization
- Error analysis

### Duplicate Detection

- Similarity distribution over 100 image pairs
- Duplicate/related/new classification checks
- Database integration test

### Resolution Verification

- Same unchanged image → Not Resolved
- Synthetic repaired image → AI Verified

### Persistence

- Resolved issue → later similar report
- Previous issue linkage
- Reopened status
- Reopening timestamp

### Backend

- Health endpoint
- Issue retrieval
- Invalid status validation
- End-to-end issue analysis

### Frontend

- Production build
- TypeScript compilation
- Citizen portal
- Authority dashboard
- Interactive map
- Risk hotspot visualization

---

## Current Limitations

CivicPulse is a research/engineering prototype, not a production municipal system.

Important limitations:

1. **Severity is heuristic.** RDD2022 does not provide the engineering measurements required for standards-based severity assessment.
2. **Priority is heuristic.** The scoring weights are design choices and require validation with domain experts or real municipal priorities.
3. **Duplicate thresholds are provisional.** Larger labeled datasets are needed for statistically reliable threshold selection.
4. **Resolution verification needs real paired data.** The current synthetic repair test validates pipeline behavior but not real-world verification accuracy.
5. **Scene matching needs further calibration.** The current threshold is provisional.
6. **RDD2022 is road-damage focused.** It does not cover every type of civic infrastructure issue.
7. **GPS accuracy depends on the user's device/browser.**
8. **No municipal impact is claimed.** Real-world deployment would require municipal integration, operational policies, privacy controls, and field validation.
9. **The current prototype is not an engineering inspection system.** AI outputs should support prioritization and review rather than replace qualified infrastructure assessment.

---

## Roadmap

Potential next-stage improvements:

- Expand beyond road damage to additional civic infrastructure categories
- Train a dedicated severity model using expert-labeled data
- Learn priority scoring from historical municipal outcomes
- Build a larger duplicate/non-duplicate benchmark
- Calibrate scene similarity using real before/after pairs
- Add temporal persistence modeling
- Add route-aware maintenance prioritization
- Add explainable AI visual overlays
- Add authentication and role-based access control
- Add automated regression/API test coverage
- Deploy frontend and backend
- Add monitoring and model drift evaluation
- Integrate with municipal workflows where appropriate

---

## Dataset & Attribution

The road-damage detector uses **RDD2022 (The multi-national Road Damage Dataset released through CRDDC 2022)**.

RDD2022 is used as the source dataset for the road-damage detection component. The dataset is distributed under **CC BY-SA 4.0**.

Official dataset resources:

- RDD2022 / CRDDC 2022: https://crddc2022.sekilab.global/data/
- RoadDamageDetector repository: https://github.com/sekilab/RoadDamageDetector
- RDD2022 dataset on Figshare: https://figshare.com/articles/dataset/RDD2022_-_The_multi-national_Road_Damage_Dataset_released_through_CRDDC_2022/21431547

The dataset itself is **not included in this repository**.

---

## Responsible Use

CivicPulse AI is intended as a decision-support prototype.

AI predictions can be wrong. Detection confidence, severity, priority, duplicate relationships, and resolution verification should therefore be treated as signals for human review rather than unquestionable decisions.

For real-world deployment, the system would require:

- Domain validation
- Privacy and data-retention policies
- Security hardening
- Human review procedures
- Model monitoring
- Bias/error analysis across locations and conditions
- Operational integration with responsible authorities

---

## Project Status

**Current status: Functional end-to-end prototype**

Implemented:

- [x] YOLO-based road-damage detection
- [x] Detection evaluation
- [x] Visual severity heuristic
- [x] Priority scoring
- [x] CLIP duplicate detection
- [x] Duplicate database linkage
- [x] Citizen issue submission
- [x] GPS capture
- [x] Authority dashboard
- [x] Issue status workflow
- [x] Resolution verification
- [x] Persistence/reopened detection
- [x] Interactive issue map
- [x] Geographic risk hotspots
- [x] Backend/frontend integration
- [x] Production frontend build

In progress:

- [ ] Final UI/UX polish
- [ ] Deployment
- [ ] Expanded evaluation datasets
- [ ] Automated end-to-end test suite
- [ ] Production-grade authentication and security
- [ ] Comprehensive documentation and demo assets

---

## Author

**Kishan Bishwakarma**

CivicPulse AI — AI-powered civic infrastructure intelligence.
