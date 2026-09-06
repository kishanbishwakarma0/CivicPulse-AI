from pathlib import Path

from ultralytics import YOLO


# Project root:
# CivicPulse-AI/
# └── backend/
#     ├── models/
#     │   └── CivicPulse-YOLO11n-baseline-best.pt
#     └── services/
#         └── detector.py

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "CivicPulse-YOLO11n-baseline-best.pt"
)


if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"YOLO model not found at: {MODEL_PATH}"
    )


model = YOLO(str(MODEL_PATH))


def detect_damage(image_path: str, confidence_threshold: float = 0.25):
    """
    Run road-damage detection on an image.

    Returns a list of detected damages with:
    - damage type
    - confidence
    - bounding box
    - bounding-box area percentage
    """

    results = model.predict(
        source=image_path,
        conf=confidence_threshold,
        verbose=False
    )

    result = results[0]

    image_height, image_width = result.orig_shape
    image_area = float(image_width * image_height)

    detections = []

    for box in result.boxes:
        class_id = int(box.cls.item())
        confidence = float(box.conf.item())

        x1, y1, x2, y2 = box.xyxy[0].tolist()

        box_width = float(x2 - x1)
        box_height = float(y2 - y1)

        box_area = box_width * box_height

        area_percent = (
            box_area / image_area
        ) * 100

        detections.append({
            "damage_type": model.names[class_id],
            "confidence": round(confidence, 3),
            "bounding_box": {
                "x1": round(float(x1), 2),
                "y1": round(float(y1), 2),
                "x2": round(float(x2), 2),
                "y2": round(float(y2), 2)
            },
            "area_percent": round(float(area_percent), 3)
        })

    return detections