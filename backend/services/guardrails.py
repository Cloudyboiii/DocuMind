NO_INFO_PHRASES = [
    "i don't have enough information",
    "not enough information",
    "no relevant information",
    "cannot answer",
    "unable to find",
]


def evaluate(answer: str, distances: list[float]) -> dict:
    """Evaluate answer confidence and check for hallucination.

    Confidence is based on ChromaDB cosine distances (lower = more similar).
    Formula: confidence = max(0, 1 - (avg_distance_top_3 / 2.0)), clamped 0-1.

    If the model honestly says it doesn't have enough info, confidence = 1.0
    (it's correctly confident about its uncertainty).

    Hallucination is flagged only when avg distance > 1.5 (context was very
    dissimilar to the question but the model still gave an answer).
    """
    answer_lower = answer.lower()

    # Model honestly declined to answer
    is_no_info = any(phrase in answer_lower for phrase in NO_INFO_PHRASES)
    if is_no_info:
        return {
            "confidence_score": 1.0,
            "confidence_label": "high",
            "hallucination_risk": False,
            "explanation": "The model correctly indicated insufficient context.",
        }

    if not distances:
        return {
            "confidence_score": 0.0,
            "confidence_label": "low",
            "hallucination_risk": True,
            "explanation": "No source documents were found.",
        }

    # Use top 3 distances for scoring
    top_distances = sorted(distances)[:3]
    avg_distance = sum(top_distances) / len(top_distances)

    confidence = max(0.0, min(1.0, 1.0 - (avg_distance / 2.0)))
    confidence = round(confidence, 2)

    hallucination_risk = avg_distance > 1.5

    if confidence >= 0.7:
        label = "high"
    elif confidence >= 0.4:
        label = "medium"
    else:
        label = "low"

    explanation = f"Based on semantic similarity of top sources (avg distance: {avg_distance:.3f})."
    if hallucination_risk:
        explanation += " Warning: retrieved context may not be relevant to the question."

    return {
        "confidence_score": confidence,
        "confidence_label": label,
        "hallucination_risk": hallucination_risk,
        "explanation": explanation,
    }
