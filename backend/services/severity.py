from dataclasses import dataclass


@dataclass
class SeverityResult:
    damage_type: str
    confidence: float
    area_percent: float
    severity_label: str


severity_thresholds = {
    "Longitudinal Crack": 5.27,
    "Transverse Crack": 2.89,
    "Alligator Crack": 22.03,
    "Pothole": 11.95
}


def estimate_severity(
    damage_type: str,
    confidence: float,
    area_percent: float
):
    moderate_threshold = severity_thresholds.get(
        damage_type,
        8.0
    )

    if area_percent < moderate_threshold * 0.25:
        label = "Low"
    elif area_percent < moderate_threshold:
        label = "Moderate"
    else:
        label = "High"

    return SeverityResult(
        damage_type=damage_type,
        confidence=round(float(confidence), 3),
        area_percent=round(float(area_percent), 3),
        severity_label=label
    )