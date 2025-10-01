from evaluate import load

def compute_scores(prediction: str, reference: str, metrics: list[str], options: dict = {}) -> dict:
    """
    Compute HuggingFace metrics.
    """
    scores = {}
    references = [reference]
    predictions = [prediction]

    for metric in metrics:
        if metric.lower() == "rouge":
            rouge = load("rouge")
            result = rouge.compute(predictions=predictions, references=references)
            scores.update({f"rouge-{k}": v for k, v in result.items()})
        elif metric.lower() == "bleu":
            bleu = load("bleu")
            result = bleu.compute(predictions=predictions, references=references)
            scores["bleu"] = result["bleu"]
        elif metric.lower() == "f1":
            f1 = load("f1")
            result = f1.compute(predictions=predictions, references=references)
            scores["f1"] = result["f1"]
        elif metric.lower() == "em":
            scores["exact_match"] = float(prediction.strip() == reference.strip())
        elif metric.lower() == "bertscore":
            bertscore = load("bertscore")
            result = bertscore.compute(predictions=predictions, references=references, lang="en")
            scores["bertscore"] = sum(result["f1"]) / len(result["f1"])
        elif metric.lower() == "perplexity":
            perp = load("perplexity")
            model_id = options.get("perplexity_model", "gpt2")
            result = perp.compute(predictions=predictions, model_id=model_id)
            scores["perplexity"] = result["perplexities"][0]
        elif metric.lower() == "accuracy":
            scores["accuracy"] = float(prediction.strip() == reference.strip())
        elif metric.lower() == "precision":
            precision = load("precision")
            result = precision.compute(predictions=predictions, references=references)
            scores["precision"] = result["precision"]
        elif metric.lower() == "recall":
            recall = load("recall")
            result = recall.compute(predictions=predictions, references=references)
            scores["recall"] = result["recall"]

    return scores
