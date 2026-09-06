from dataclasses import dataclass


@dataclass
class PriorityResult:
    damage_type: str
    severity: str
    confidence: float
    area_percent: float
    priority_score: float
    priority_level: str


damage_weights = {
    "Pothole": 1.00,
    "Alligator Crack": 0.90,
    "Transverse Crack": 0.75,
    "Longitudinal Crack": 0.65
}


severity_weights = {
    "Low": 0.30,
    "Moderate": 0.65,
    "High": 1.00
}


def calculate_priority(
    damage_type: str,
    severity: str,
    confidence: float,
    area_percent: float
):
    damage_weight = damage_weights.get(
        damage_type,
        0.50
    )

    severity_weight = severity_weights.get(
        severity,
        0.50
    )

    extent_score = min(
        float(area_percent) / 25.0,
        1.0
    )

    confidence_score = float(confidence)

    score = (
        0.40 * severity_weight
        + 0.25 * damage_weight
        + 0.20 * extent_score
        + 0.15 * confidence_score
    ) * 100

    score = round(
        min(max(score, 0.0), 100.0),
        2
    )

    if score >= 75:
        priority_level = "Critical"
    elif score >= 55:
        priority_level = "High"
    elif score >= 35:
        priority_level = "Medium"
    else:
        priority_level = "Low"

    return PriorityResult(
        damage_type=damage_type,
        severity=severity,
        confidence=round(confidence_score, 3),
        area_percent=round(float(area_percent), 3),
        priority_score=score,
        priority_level=priority_level
    )