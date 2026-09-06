from functools import lru_cache

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor


MODEL_NAME = "openai/clip-vit-base-patch32"


@lru_cache(maxsize=1)
def get_clip():
    """
    Load CLIP once and reuse it for subsequent requests.
    """
    device = "cuda" if torch.cuda.is_available() else "cpu"

    processor = CLIPProcessor.from_pretrained(MODEL_NAME)
    model = CLIPModel.from_pretrained(MODEL_NAME)
    model.to(device)
    model.eval()

    return processor, model, device


def get_image_embedding(image_path: str) -> list[float]:
    """
    Generate a normalized 512-dimensional CLIP image embedding.

    We explicitly run the vision encoder and visual projection instead of
    calling CLIPModel.get_image_features(), because recent Transformers
    versions can expose a different return structure for this method.
    """
    processor, model, device = get_clip()

    image = Image.open(image_path).convert("RGB")

    inputs = processor(images=image, return_tensors="pt")
    pixel_values = inputs["pixel_values"].to(device)

    with torch.no_grad():
        vision_outputs = model.vision_model(
            pixel_values=pixel_values
        )

        pooled_output = vision_outputs.pooler_output

        image_features = model.visual_projection(
            pooled_output
        )

    if image_features.ndim != 2:
        raise RuntimeError(
            f"Unexpected CLIP embedding shape: {tuple(image_features.shape)}"
        )

    embedding = image_features / image_features.norm(
        p=2,
        dim=-1,
        keepdim=True
    )

    return embedding[0].detach().cpu().tolist()


def cosine_similarity(
    embedding_a: list[float],
    embedding_b: list[float]
) -> float:
    """
    Calculate cosine similarity only when both embeddings have the same
    dimensionality.
    """
    if len(embedding_a) != len(embedding_b):
        raise ValueError(
            f"Embedding dimension mismatch: "
            f"{len(embedding_a)} vs {len(embedding_b)}"
        )

    a = torch.tensor(embedding_a, dtype=torch.float32)
    b = torch.tensor(embedding_b, dtype=torch.float32)

    similarity = torch.nn.functional.cosine_similarity(
        a.unsqueeze(0),
        b.unsqueeze(0)
    )

    return float(similarity.item())


def classify_duplicate(
    similarity: float,
    same_damage_type: bool
) -> str:
    """
    Prototype thresholds based on the 100-pair calibration previously run.

    >= 0.82 + same damage type -> Duplicate
    >= 0.70                    -> Related
    otherwise                  -> New Issue

    These thresholds are prototype thresholds, not validated production
    duplicate-classification metrics.
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
    Find the most similar existing issue that has an embedding.
    """
    best_match = None

    for issue in existing_issues:
        stored_embedding = issue.get("image_embedding")

        if not stored_embedding:
            continue

        # The current CLIP model produces 512-dimensional embeddings.
        # Ignore legacy/malformed embeddings rather than crashing the API.
        if len(stored_embedding) != len(image_embedding):
            continue

        # Ignore legacy embeddings from a different CLIP representation.
        if len(stored_embedding) != len(image_embedding):
            continue

        try:
            similarity = cosine_similarity(
                image_embedding,
                stored_embedding
            )
        except (TypeError, ValueError, RuntimeError):
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
            "similarity": round(similarity, 4),
            "same_damage_type": same_damage_type,
            "classification": classification
        }

        if (
            best_match is None
            or candidate["similarity"] > best_match["similarity"]
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
