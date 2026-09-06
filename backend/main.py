from pathlib import Path
import shutil
import tempfile
from uuid import uuid4

from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, File, UploadFile, HTTPException, Form

from database import supabase

from services.detector import detect_damage
from services.severity import estimate_severity
from services.priority import calculate_priority
from services.duplicate import get_image_embedding, cosine_similarity, find_best_match


app = FastAPI(
    title="CivicPulse AI API",
    description="AI-powered civic issue detection, prioritization and resolution verification",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "project": "CivicPulse AI",
        "status": "running"
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy"
    }

@app.get("/api/issues")
def get_issues():
    response = (
        supabase
        .table("issues")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "issues": response.data
    }

@app.patch("/api/issues/{issue_id}/status")
def update_issue_status(
    issue_id: str,
    status: str
):
    allowed_statuses = {
        "Reported",
        "In Progress",
        "Resolved"
    }

    if status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed values: {sorted(allowed_statuses)}"
        )

    response = (
        supabase
        .table("issues")
        .update({
            "status": status,
            "updated_at": "now()"
        })
        .eq("id", issue_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Issue not found."
        )

    return {
        "message": "Issue status updated successfully",
        "issue": response.data[0]
    }

@app.post("/api/issues/{issue_id}/verify")
async def verify_issue_resolution(
    issue_id: str,
    file: UploadFile = File(...)
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file."
        )

    # Fetch the original issue
    issue_response = (
        supabase
        .table("issues")
        .select("*")
        .eq("id", issue_id)
        .execute()
    )

    if not issue_response.data:
        raise HTTPException(
            status_code=404,
            detail="Issue not found."
        )

    issue = issue_response.data[0]

    if not issue.get("image_url"):
        raise HTTPException(
            status_code=400,
            detail="Original issue image is missing."
        )

    suffix = Path(file.filename or "").suffix or ".jpg"
    temp_path = None

    try:
        # Save uploaded AFTER image temporarily
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:
            shutil.copyfileobj(
                file.file,
                temp_file
            )
            temp_path = temp_file.name

        # Upload AFTER image to Supabase Storage
        resolution_storage_path = (
            f"resolution/{uuid4()}{suffix}"
        )

        with open(temp_path, "rb") as image_file:
            image_bytes = image_file.read()

        supabase.storage.from_("issue-images").upload(
            resolution_storage_path,
            image_bytes,
            {
                "content-type": file.content_type or "image/jpeg"
            }
        )

        # Download and analyze the ORIGINAL BEFORE image from Supabase Storage.
        # This avoids relying on the previously stored database measurements.
        before_storage_path = issue["image_url"]
        before_suffix = Path(before_storage_path).suffix or ".jpg"
        before_temp_path = None

        try:
            before_image_bytes = (
                supabase
                .storage
                .from_("issue-images")
                .download(before_storage_path)
            )

            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=before_suffix
            ) as before_file:
                before_file.write(before_image_bytes)
                before_temp_path = before_file.name

            before_detections = detect_damage(before_temp_path)

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Could not load original issue image: {str(e)}"
            )

        # Analyze AFTER image
        after_detections = detect_damage(temp_path)

        # Verify that BEFORE and AFTER images show the same scene.
        # This prevents an unrelated image from being treated as repair evidence.
        before_embedding = get_image_embedding(before_temp_path)
        after_embedding = get_image_embedding(temp_path)
        scene_similarity = cosine_similarity(
            before_embedding,
            after_embedding
        )

        # Provisional scene-matching threshold. This should be calibrated
        # later with a labeled set of same-location and different-location pairs.
        scene_match_threshold = 0.70
        same_scene = scene_similarity >= scene_match_threshold

        # Use the freshly re-run BEFORE detection as the reference.
        before_area = 0.0

        if before_detections:
            before_area = max(
                float(detection["area_percent"])
                for detection in before_detections
            )

        after_area = 0.0

        if after_detections:
            after_area = max(
                float(detection["area_percent"])
                for detection in after_detections
            )

        if before_area > 0:
            area_reduction = (
                (before_area - after_area)
                / before_area
            ) * 100
        else:
            area_reduction = 0.0

        area_reduction = round(
            max(0.0, min(100.0, area_reduction)),
            2
        )

        # Use the freshly detected BEFORE damage type.
        if before_detections:
            original_damage_type = max(
                before_detections,
                key=lambda detection: float(detection["confidence"])
            )["damage_type"]
        else:
            original_damage_type = issue["damage_type"]

        matching_damage = any(
            detection["damage_type"] == original_damage_type
            for detection in after_detections
        )

        if not same_scene:
            verification_status = "Inconclusive"

        elif not before_detections:
            verification_status = "Inconclusive"

        elif (
            matching_damage
            and area_reduction >= 70
        ):
            verification_status = "AI Verified"

        elif (
            matching_damage
            and area_reduction >= 30
        ):
            verification_status = "Partially Resolved"

        elif not after_detections:
            verification_status = "AI Verified"

        else:
            verification_status = "Not Resolved"

        # Update issue
        update_response = (
            supabase
            .table("issues")
            .update({
                "resolution_image_url": resolution_storage_path,
                "verification_status": verification_status,
                "area_reduction_percent": area_reduction,
                "verified_at": "now()",
                "status": (
                    "Resolved"
                    if verification_status == "AI Verified"
                    else issue["status"]
                )
            })
            .eq("id", issue_id)
            .execute()
        )

        return {
            "issue_id": issue_id,
            "verification_status": verification_status,
            "before_damage_type": original_damage_type,
            "before_area_percent": round(before_area, 3),
            "after_area_percent": round(after_area, 3),
            "area_reduction_percent": area_reduction,
            "scene_similarity": round(scene_similarity, 4),
            "scene_match_threshold": scene_match_threshold,
            "same_scene": same_scene,
            "before_detections": before_detections,
            "after_detections": after_detections,
            "resolution_image_url": resolution_storage_path,
            "issue": (
                update_response.data[0]
                if update_response.data
                else None
            )
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Resolution verification failed: {str(e)}"
        )

    finally:
        if temp_path:
            Path(temp_path).unlink(
                missing_ok=True
            )

        if "before_temp_path" in locals() and before_temp_path:
            Path(before_temp_path).unlink(
                missing_ok=True
            )

@app.post("/api/issues/analyze")
async def analyze_issue(
    file: UploadFile = File(...),
    description: str = Form(""),
    location: str = Form(""),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None)
):
    # Validate uploaded file
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file."
        )

    # Save uploaded image temporarily
    suffix = Path(file.filename or "").suffix

    if not suffix:
        suffix = ".jpg"

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            shutil.copyfileobj(
                file.file,
                temp_file
            )

            temp_path = temp_file.name

        # Run YOLO detection
        detections = detect_damage(temp_path)

        # Upload original image to Supabase Storage
        file_extension = Path(file.filename or "image.jpg").suffix or ".jpg"

        storage_path = (
            f"{uuid4()}{file_extension}"
        )

        with open(temp_path, "rb") as image_file:
            image_bytes = image_file.read()

        supabase.storage.from_("issue-images").upload(
            storage_path,
            image_bytes,
            {
                "content-type": file.content_type or "image/jpeg"
            }
        )

        # Generate one CLIP embedding for the uploaded image.
        image_embedding = get_image_embedding(temp_path)

        if not detections:
            return {
                "filename": file.filename,
                "detections": [],
                "message": "No road damage detected."
            }

        # Fetch previous issues that already have image embeddings.
        existing_issues_response = (
            supabase
            .table("issues")
            .select("id, damage_type, image_embedding, status, latitude, longitude, created_at")
            .execute()
        )

        existing_issues = [
            issue
            for issue in (existing_issues_response.data or [])
            if issue.get("image_embedding")
        ]

        analyzed_detections = []

        for detection in detections:

            severity = estimate_severity(
                damage_type=detection["damage_type"],
                confidence=detection["confidence"],
                area_percent=detection["area_percent"]
            )

            priority = calculate_priority(
                damage_type=detection["damage_type"],
                severity=severity.severity_label,
                confidence=detection["confidence"],
                area_percent=detection["area_percent"]
            )

            duplicate_match = find_best_match(
                image_embedding=image_embedding,
                damage_type=detection["damage_type"],
                existing_issues=existing_issues
            )

            matched_issue = next(
                (
                    existing_issue
                    for existing_issue in existing_issues
                    if existing_issue.get("id") == duplicate_match["issue_id"]
                ),
                None
            )

            persistence_status = None
            related_issue_id = None
            reopened_at = None

            # Check persistence against resolved issues specifically.
            # This avoids missing a reopened issue when another identical
            # reported record happens to be selected as the best duplicate.
            if duplicate_match["classification"] == "Duplicate":
                resolved_issues = [
                    issue
                    for issue in existing_issues
                    if issue.get("status") == "Resolved"
                ]

                resolved_match = (
                    find_best_match(
                        image_embedding=image_embedding,
                        damage_type=detection["damage_type"],
                        existing_issues=resolved_issues
                    )
                    if resolved_issues
                    else None
                )

                if (
                    resolved_match
                    and resolved_match["classification"] == "Duplicate"
                ):
                    persistence_status = "Reopened"
                    related_issue_id = resolved_match["issue_id"]
                    reopened_at = "now()"

            issue_row = {
                "image_url": storage_path,
                "description": description,
                "location": location,
                "damage_type": detection["damage_type"],
                "confidence": detection["confidence"],
                "area_percent": detection["area_percent"],
                "severity": severity.severity_label,
                "priority_score": priority.priority_score,
                "priority_level": priority.priority_level,
                "latitude": latitude,
                "longitude": longitude,
                "status": "Reported",
                "image_embedding": image_embedding,
                "duplicate_status": duplicate_match["classification"],
                "duplicate_issue_id": duplicate_match["issue_id"],
                "duplicate_similarity": duplicate_match["similarity"],
                "persistence_status": persistence_status,
                "related_issue_id": related_issue_id,
                "reopened_at": reopened_at
            }

            db_response = (
                supabase
                .table("issues")
                .insert(issue_row)
                .execute()
            )

            issue_id = (
                db_response.data[0]["id"]
                if db_response.data
                else None
            )

            analyzed_detections.append({
                "issue_id": issue_id,
                "damage_type": detection["damage_type"],
                "confidence": detection["confidence"],
                "bounding_box": detection["bounding_box"],
                "area_percent": detection["area_percent"],
                "severity": severity.severity_label,
                "priority_score": priority.priority_score,
                "priority_level": priority.priority_level,
                "duplicate_status": duplicate_match["classification"],
                "duplicate_issue_id": duplicate_match["issue_id"],
                "duplicate_similarity": duplicate_match["similarity"],
                "persistence_status": persistence_status,
                "related_issue_id": related_issue_id,
                "reopened_at": reopened_at
            })

        return {
            "filename": file.filename,
            "detections": analyzed_detections
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

    finally:
        if temp_path:
            Path(temp_path).unlink(
                missing_ok=True
            )