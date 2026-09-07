import cv2
import numpy as np


def get_image_embedding(image_path: str) -> list[float]:
    """
    Generate a lightweight normalized image embedding using HSV color
    histogram + grayscale spatial features.

    This avoids PyTorch/CLIP so the FastAPI service can run within
    Render's free memory limit.
    """
    image = cv2.imread(image_path)

    if image is None:
        raise RuntimeError(
            f"Unable to read image: {image_path}"
        )

    # Resize for consistent processing
    image = cv2.resize(image, (256, 256))

    # HSV histogram captures overall visual/color characteristics
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    histogram = cv2.calcHist(
        [hsv],
        [0, 1],
        None,
        [16, 16],
        [0, 180, 0, 256]
    )

    histogram = cv2.normalize(
        histogram,
        histogram
    ).flatten()

    # Small grayscale spatial representation
    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    spatial = cv2.resize(
        gray,
        (16, 16)
    ).astype(np.float32)

    spatial /= 255.0

    embedding = np.concatenate([
        histogram,
        spatial.flatten()
    ]).astype(np.float32)

    # L2 normalization
    norm = np.linalg.norm(embedding)

    if norm == 0:
        raise RuntimeError(
            "Unable to generate a valid image embedding."
        )

    embedding /= norm

    return embedding.tolist()


def cosine_similarity(
    embedding_a: list[float],
    embedding_b: list[float]
) -> float:
    """
    Calculate cosine similarity between two embeddings.
    """

    if len(embedding_a) != len(embedding_b):
        raise ValueError(
            f"Embedding dimension mismatch: "
            f"{len(embedding_a)} vs {len(embedding_b)}"
        )

    a = np.asarray(
        embedding_a,
        dtype=np.float32
    )

    b = np.asarray(
        embedding_b,
        dtype=np.float32
    )

    denominator = (
        np.linalg.norm(a) *
        np.linalg.norm(b)
    )

    if denominator == 0:
        return 0.0

    return float(
        np.dot(a, b) / denominator
    )


def classify_duplicate(
    similarity: float,
    same_damage_type: bool
) -> str:
    """
    Classify an issue based on image similarity.

    NOTE:
    These thresholds were originally calibrated for CLIP embeddings.
    They MUST be recalibrated for the new lightweight embedding before
    being treated as production-quality thresholds.
    """

    if similarity >= 0.82 and same_damage_type:
        return "Duplicate"

    if similarity >= 0.70:
        return "Related"

    return "New Issue"


def find_best_match(
    image_embedding: list[float],
    damage_type: str,
    existing_issues: list[dict]
) -> dict:
    """
    Find the most similar existing issue that has a valid embedding.
    """

    best_match = None

    for issue in existing_issues:
        stored_embedding = issue.get("image_embedding")

        if not stored_embedding:
            continue

        if len(stored_embedding) != len(image_embedding):
            continue

        try:
            similarity = cosine_similarity(
                image_embedding,
                stored_embedding
            )
        except (
            TypeError,
            ValueError,
            RuntimeError
        ):
            continue

        same_damage_type = (
            issue.get("damage_type") == damage_type
        )

        classification = classify_duplicate(
            similarity=similarity,
            same_damage_type=same_damage_type
        )

        candidate = {
            "issue_id": issue.get("id"),
            "similarity": round(
                similarity,
                4
            ),
            "same_damage_type": same_damage_type,
            "classification": classification
        }

        if (
            best_match is None
            or candidate["similarity"]
            > best_match["similarity"]
        ):
            best_match = candidate

    if best_match is None:
        return {
            "issue_id": None,
            "similarity": 0.0,
            "same_damage_type": False,
            "classification": "New Issue"
        }

    return best_match