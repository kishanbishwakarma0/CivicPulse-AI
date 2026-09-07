# CivicPulse AI

> **Reporting a civic issue is easy. Proving it was actually fixed is the problem.**

CivicPulse AI is an AI-powered civic infrastructure intelligence platform that detects road damage, estimates visual severity, prioritizes reported issues, identifies duplicate reports, verifies claimed repairs, detects persistent/reopened issues, and highlights geographic risk hotspots.

It combines computer vision, image similarity, geospatial analysis, a FastAPI backend, a Next.js frontend, and Supabase.

---

## Why CivicPulse?

Traditional civic complaint systems mainly answer:

**"Was an issue reported?"**

CivicPulse goes further:

- What type of damage is visible?
- How severe does it appear visually?
- Which issues should be prioritized?
- Is this report a duplicate?
- Was the reported damage actually reduced after repair?
- Did a previously resolved issue reappear?
- Where are multiple high-risk issues concentrated?

The platform focuses on:

**Detection → Prioritization → Resolution Verification → Persistence Intelligence**

---

## Core Features

### 1. AI Road-Damage Detection

CivicPulse uses a **YOLO11n** object detection model trained on the **RDD2022** road-damage dataset.

Supported damage classes:

| Class | Description |
|---|---|
| Longitudinal Crack | Crack mainly along the road direction |
| Transverse Crack | Crack mainly across the road direction |
| Alligator Crack | Interconnected fatigue cracking |
| Pothole | Localized pavement damage |

The model provides:

- Damage type
- Detection confidence
- Bounding box
- Estimated affected image area

---

### 2. Visual Severity Estimation

Severity is estimated using a transparent visual heuristic based on:

- Damage type
- Detected affected area

Severity levels:

- Low
- Moderate
- High

This is an AI-assisted visual estimate and **not an engineering-grade pavement severity classification**.

---

### 3. Priority Scoring

CivicPulse converts detection signals into a **0–100 priority score**.

The score considers:

- Visual severity
- Damage type
- Affected area
- Detection confidence

Priority levels:

- Low
- Medium
- High
- Critical

The scoring system is a prototype heuristic rather than a municipal policy standard.

---

### 4. Duplicate Issue Detection

CivicPulse uses lightweight image embeddings generated with **OpenCV and NumPy** and compares them using cosine similarity.

Reports can be classified as:

- **Duplicate**
- **Related**
- **New Issue**

The current similarity thresholds are prototype engineering thresholds and require further calibration with a larger labeled dataset.

---

### 5. AI Resolution Verification

One of CivicPulse's main differentiators is **AI-assisted repair verification**.

When an authority uploads an after-repair image, the system:

1. Re-analyzes the original issue image.
2. Analyzes the submitted repair image.
3. Checks whether both images represent the same scene.
4. Compares detected damage.
5. Estimates detected-area reduction.
6. Produces a verification result.

Possible outcomes:

- **AI Verified**
- **Partially Resolved**
- **Not Resolved**
- **Inconclusive**

This provides visual evidence before an issue is considered resolved.

---

### 6. Persistent / Reopened Issues

CivicPulse can connect a new report to a previously resolved issue when sufficient similarity and location/scene evidence exists.

```text
Reported
   ↓
In Progress
   ↓
Resolved
   ↓
AI Verified
   ↓
New Similar Report
   ↓
Linked to Previous Issue
   ↓
Reopened / Persistent

This helps identify recurring infrastructure problems instead of treating every report as an isolated complaint.
7. Geographic Risk Hotspots

GPS-enabled issues are grouped geographically to identify areas containing multiple nearby high-priority issues.

The dashboard provides:

    Hotspot clusters

    Cluster size

    Risk score

    Risk level

    Cluster center

    Nearby issues

    Interactive map visualization

This creates a geographic risk-intelligence layer over individual complaints.
End-to-End Workflow

Citizen
   │
   ├── Upload issue image
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
      Severity Estimation
            │
            ▼
       Priority Scoring
            │
            ├───────────────┐
            ▼               ▼
     Duplicate Check     Supabase
            │             Storage
            └──────┬────────┘
                   ▼
          Authority Dashboard
                   │
             ┌─────┴─────┐
             ▼           ▼
       Status Flow   Repair Upload
             │           │
             │           ▼
             │    Scene Comparison
             │           │
             │           ▼
             │   Resolution Verification
             │           │
             └───────────┤
                         ▼
                 Future Reports
                         │
                         ▼
                Persistent/Reopened

System Architecture

┌─────────────────────────────────┐
│          Next.js Frontend       │
│  Citizen Portal + Authority UI │
└───────────────┬─────────────────┘
                │ REST API
                ▼
┌─────────────────────────────────┐
│            FastAPI              │
│         Backend Services        │
├─────────────────────────────────┤
│ Detection                       │
│ Severity                        │
│ Priority                        │
│ Duplicate Detection             │
│ Resolution Verification         │
│ Persistence Detection           │
│ Authority Authentication        │
└───────────────┬─────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌──────────────┐  ┌────────────────┐
│ YOLO11n      │  │    Supabase    │
│ PyTorch      │  │ PostgreSQL     │
│ OpenCV       │  │ Storage        │
└──────────────┘  └────────────────┘

Machine Learning
Road-Damage Detector

Model: YOLO11n

Dataset: RDD2022

Training configuration:
Parameter	Value
Epochs	50
Image Size	640
Batch Size	16
GPU	NVIDIA Tesla T4
Classes	4
Independent Test Results
Metric	Result
Precision	0.627
Recall	0.590
mAP@50	0.611
mAP@50–95	0.335
Class-wise Results
Damage Type	Precision	Recall	mAP@50	mAP@50–95
Longitudinal Crack	0.620	0.524	0.553	0.303
Transverse Crack	0.554	0.519	0.521	0.257
Alligator Crack	0.679	0.591	0.638	0.331
Pothole	0.653	0.725	0.731	0.449
Overall	0.627	0.590	0.611	0.335

Pothole detection is currently the strongest class, while transverse cracking is comparatively more difficult for the baseline model.
Resolution Verification

The verifier compares a before-repair image with an after-repair image.

Before Image ──┐
               ├── Scene Similarity
After Image ───┘
                     │
                     ▼
                 Same Scene?
                /           \
              No             Yes
              │               │
              ▼               ▼
        Inconclusive    Damage Comparison
                              │
                              ▼
                        Area Reduction
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
             ≥70%           ≥30%           <30%
               │              │              │
               ▼              ▼              ▼
          AI Verified    Partially       Not Resolved
                          Resolved

The pipeline has been tested with:

    Same unchanged image → Not Resolved

    Synthetic repaired image → AI Verified

    Synthetic repair test → 100% detected-area reduction

The synthetic test validates pipeline behavior and does not represent real-world repair accuracy.
Authority Authentication

CivicPulse includes a dedicated authority login system.

Authentication provides:

    Username/password login

    Signed authentication token

    8-hour session expiry

    Protected authority dashboard

    Protected issue status updates

    Protected resolution verification

    Logout functionality

The current implementation uses a single configured authority account and is intended for the prototype rather than a multi-user municipal identity system.
API
Method	Endpoint	Purpose
GET	/api/health	Backend health check
POST	/api/auth/login	Authority login
GET	/api/auth/me	Verify authority session
GET	/api/issues	Retrieve issues
POST	/api/issues/analyze	Analyze a new issue
PATCH	/api/issues/{issue_id}/status	Update issue status
POST	/api/issues/{issue_id}/verify	Verify repair

Interactive API documentation:

https://civicpulse-ai-backend-gnkx.onrender.com/docs

Technology Stack
Frontend

    Next.js

    React

    TypeScript

    Tailwind CSS

    shadcn/ui

    Leaflet

    React Leaflet

    Recharts

Backend

    Python

    FastAPI

    Pydantic

    Uvicorn

Machine Learning

    Ultralytics YOLO

    YOLO11n

    PyTorch

    OpenCV

    NumPy

Database & Storage

    Supabase PostgreSQL

    Supabase Storage

Maps

    Leaflet

    OpenStreetMap

Development

    Git

    GitHub

    Kaggle GPU environment

Project Structure

CivicPulse-AI/
│
├── backend/
│   ├── main.py
│   ├── auth.py
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
│   │   ├── login/
│   │   └── page.tsx
│   └── components/
│
├── ml/
│   └── data.yml
│
├── .gitignore
└── README.md

    The trained model, datasets, environment secrets, build artifacts, and dependency directories are excluded from Git history.

Local Setup
Prerequisites

    Python 3.13

    Node.js

    npm

    Git

    Supabase project

    Required model assets

1. Clone Repository

git clone https://github.com/kishanbishwakarma0/CivicPulse-AI.git
cd CivicPulse-AI

2. Backend Environment

python -m venv .venv
call .venv\Scripts\activate

Install dependencies:

cd backend
pip install -r requirements.txt

3. Environment Variables

Create a root .env file:

SUPABASE_URL=your_supabase_project_url
SUPABASE_SECRET_KEY=your_backend_only_secret_key

AUTHORITY_USERNAME=your_authority_username
AUTHORITY_PASSWORD=your_authority_password
AUTH_TOKEN_SECRET=your_long_random_secret

Never commit .env or expose backend secrets in the frontend.
4. Frontend Environment

Create:

frontend/.env.local

Add:

NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

5. Start Backend

From backend/:

uvicorn main:app --reload

Backend:

http://127.0.0.1:8000

Swagger:

http://127.0.0.1:8000/docs

6. Start Frontend

From frontend/:

npm install
npm run dev

Frontend:

http://localhost:3000

Authority dashboard:

http://localhost:3000/dashboard

Database

CivicPulse stores:

    Damage type

    Detection confidence

    Affected area

    Severity

    Priority score

    Priority level

    GPS coordinates

    Description and location

    Issue status

    Resolution information

    Verification result

    Duplicate relationships

    Image embeddings

    Persistence relationships

Supabase Storage is used for issue and resolution images.
Evaluation & Testing
Model

    Independent test evaluation

    Class-wise detection metrics

    Precision

    Recall

    mAP@50

    mAP@50–95

Resolution Verification

    Unchanged image test

    Synthetic repaired-image test

    Area-reduction verification

Persistence

    Previous issue linkage

    Reopened issue detection

    Persistence status

Application

    Backend health

    Issue analysis

    Status workflow

    Authority authentication

    Resolution verification

    Production frontend build

    Authority dashboard

    Interactive map

    Risk hotspot visualization

Current Limitations

CivicPulse AI is a research/engineering prototype, not a production municipal inspection system.

Important limitations:

    Severity is heuristic. It is based on visual signals rather than engineering measurements.

    Priority is heuristic. The scoring weights are prototype design choices.

    Duplicate thresholds require further calibration.

    Resolution verification needs real before/after datasets for proper validation.

    Scene similarity requires additional calibration.

    RDD2022 focuses on road damage and does not cover every civic infrastructure problem.

    GPS accuracy depends on the user's device and browser.

    AI predictions should support human review rather than replace qualified infrastructure assessment.

    No municipal impact or partnership is claimed.

Dataset & Attribution

The road-damage detector uses RDD2022 — The multi-national Road Damage Dataset released through CRDDC 2022.

RDD2022 is used for the road-damage detection component and is distributed under CC BY-SA 4.0.

Official resources:

    RDD2022 / CRDDC 2022

    RoadDamageDetector repository

    RDD2022 dataset on Figshare

The dataset itself is not included in this repository.
Responsible Use

CivicPulse AI is intended as a decision-support prototype.

AI predictions can be incorrect. Detection confidence, severity, priority, duplicate relationships, and resolution verification should therefore be treated as signals for human review.

Real-world deployment would require:

    Domain validation

    Privacy and data-retention policies

    Security hardening

    Human review procedures

    Model monitoring

    Bias and error analysis

    Operational integration with responsible authorities

Deployment
Frontend

Vercel

https://civic-pulse-ai-xi.vercel.app/
Backend

Render

https://civicpulse-ai-backend-gnkx.onrender.com
Database & Storage

Supabase

The production deployment uses the Next.js frontend, FastAPI backend, and Supabase PostgreSQL/Storage infrastructure.
Project Status

Current Status: Functional End-to-End Prototype

Implemented:

    YOLO11n road-damage detection

    Detection evaluation

    Visual severity estimation

    Priority scoring

    Duplicate issue detection

    Duplicate database linkage

    Citizen issue submission

    GPS capture

    Authority authentication

    Authority dashboard

    Issue status workflow

    AI resolution verification

    Persistent/reopened issue detection

    Interactive issue map

    Geographic risk hotspots

    Supabase integration

    Production frontend deployment

    Production backend deployment

Future Improvements

    Larger duplicate-detection benchmark

    Real before/after repair dataset

    Dedicated severity model

    Learned priority scoring

    More civic infrastructure categories

    Explainable AI overlays

    Advanced persistence modeling

    Model monitoring and drift evaluation

    Multi-user role-based authority access

Author

Kishan Bishwakarma

CivicPulse AI — AI-powered civic infrastructure intelligence.
