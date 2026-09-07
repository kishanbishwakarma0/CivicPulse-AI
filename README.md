# CivicPulse AI

> **Reporting a civic issue is easy. Proving it was actually fixed is the problem.**

CivicPulse AI is an AI-powered civic infrastructure intelligence platform that detects road damage, estimates visual severity, prioritizes reported issues, identifies duplicate reports, verifies claimed repairs, detects persistent/reopened issues, and highlights geographic risk hotspots.

It is designed as a technical prototype combining computer vision, image similarity, geospatial analysis, a FastAPI backend, a Next.js frontend, and Supabase.

---

## Why CivicPulse?

Traditional civic complaint systems mainly answer:

**"Was an issue reported?"**

CivicPulse goes further:

- What type of damage is visible?
- How severe does it appear visually?
- Which issues should be prioritized?
- Is this report a duplicate of an existing issue?
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
| Longitudinal Crack | Crack running mainly along the road direction |
| Transverse Crack | Crack running mainly across the road direction |
| Alligator Crack | Interconnected fatigue cracking |
| Pothole | Localized pavement damage/depression |

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

The scoring system is a transparent prototype heuristic rather than a municipal policy standard.

---

### 4. Duplicate Issue Detection

CivicPulse generates lightweight image embeddings using **OpenCV and NumPy** and compares them using cosine similarity.

Reports can be classified as:

- **Duplicate**
- **Related**
- **New Issue**

The current similarity thresholds are prototype engineering thresholds and require further calibration using a larger labeled dataset.

---

### 5. AI Resolution Verification

One of CivicPulse's main differentiators is **AI-assisted repair verification**.

When an authority uploads an after-repair image, the system:

1. Re-analyzes the original issue image.
2. Analyzes the submitted repair image.
3. Checks whether the images represent the same scene.
4. Compares detected damage.
5. Estimates detected-area reduction.
6. Produces a verification result.

Possible outcomes:

- **AI Verified**
- **Partially Resolved**
- **Not Resolved**
- **Inconclusive**

This helps prevent an issue from being marked resolved without visual evidence.

---

### 6. Persistent / Reopened Issues

CivicPulse can connect a new report to a previously resolved issue when sufficient similarity and location/scene evidence exists.

Example:

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
