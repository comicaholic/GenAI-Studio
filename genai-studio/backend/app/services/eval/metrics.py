# backend/app/services/eval/metrics.py
from typing import Dict, List, Tuple
import evaluate
import numpy as np
from sklearn.metrics import precision_recall_fscore_support, accuracy_score

# --- helpers ---
def _tok(s: str) -> List[str]:
    return s.split()

def exact_match(pred: str, ref: str) -> float:
    return float(pred.strip() == ref.strip())

def bleu_score(pred: str, ref: str) -> float:
    if not pred.strip() or not ref.strip():
        return 0.0
    try:
        bleu = evaluate.load("bleu")
        return float(bleu.compute(predictions=[pred], references=[[ref]])["bleu"])
    except Exception as e:
        print(f"BLEU score error: {e}")
        return 0.0

def rouge_score(pred: str, ref: str) -> Dict[str, float]:
    if not pred.strip() or not ref.strip():
        return {"rouge1": 0.0, "rouge2": 0.0, "rougeL": 0.0, "rougeLsum": 0.0}
    try:
        rouge = evaluate.load("rouge")
        # ROUGE expects references as list of lists for multiple references per prediction
        res = rouge.compute(predictions=[pred], references=[[ref]])
        # Extract the main ROUGE scores
        return {
            "rouge1": float(res.get("rouge1", 0.0)),
            "rouge2": float(res.get("rouge2", 0.0)), 
            "rougeL": float(res.get("rougeL", 0.0)),
            "rougeLsum": float(res.get("rougeLsum", 0.0))
        }
    except Exception as e:
        print(f"ROUGE score error: {e}")
        return {"rouge1": 0.0, "rouge2": 0.0, "rougeL": 0.0, "rougeLsum": 0.0}

def bertscore_score(pred: str, ref: str) -> Dict[str, float]:
    if not pred.strip() or not ref.strip():
        return {"bertscore_precision": 0.0, "bertscore_recall": 0.0, "bertscore_f1": 0.0}
    try:
        bert = evaluate.load("bertscore")
        res = bert.compute(predictions=[pred], references=[ref], lang="en")
        
        # Validate that we got valid results
        if not res or "f1" not in res or not res["f1"]:
            print("BERTScore returned empty results")
            return {"bertscore_precision": 0.0, "bertscore_recall": 0.0, "bertscore_f1": 0.0}
            
        return {
            "bertscore_precision": float(np.mean(res["precision"])),
            "bertscore_recall": float(np.mean(res["recall"])),
            "bertscore_f1": float(np.mean(res["f1"])),
        }
    except Exception as e:
        print(f"BERTScore error: {e}")
        return {"bertscore_precision": 0.0, "bertscore_recall": 0.0, "bertscore_f1": 0.0}

def perplexity_score(pred: str, model_id: str = "gpt2") -> float:
    """
    Uses HF evaluate perplexity. This requires downloading a small LM (gpt2 by default).
    """
    if not pred.strip():
        return 0.0
    try:
        ppl = evaluate.load("perplexity", module_type="measurement")
        res = ppl.compute(model_id=model_id, add_start_token=True, data=[pred])
        return float(np.mean(res["perplexities"]))
    except Exception as e:
        print(f"Perplexity score error: {e}")
        return 0.0

def prf1_accuracy_token(pred: str, ref: str) -> Dict[str, float]:
    """
    Token-level classification: treat each token as a label; match by position.
    This is a pragmatic way to expose HF/Sklearn metrics on text without gold labels.
    """
    p = _tok(pred); r = _tok(ref)
    
    # Handle empty cases
    if not p and not r:
        return {"accuracy": 1.0, "precision": 1.0, "recall": 1.0, "f1": 1.0}
    if not p or not r:
        return {"accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0}
    
    # Pad shorter sequence with empty strings
    n = max(len(p), len(r))
    p_padded = p + [""] * (n - len(p))
    r_padded = r + [""] * (n - len(r))
    
    # Create binary labels: 1 if tokens match, 0 if they don't
    y_true = [1 if r_padded[i] == r_padded[i] else 0 for i in range(n)]  # All positions are "true" tokens
    y_pred = [1 if p_padded[i] == r_padded[i] else 0 for i in range(n)]  # Match if tokens are equal
    
    # Calculate metrics
    acc = accuracy_score(y_true, y_pred)
    prec, rec, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="binary", zero_division=0)
    
    return {"accuracy": float(acc), "precision": float(prec), "recall": float(rec), "f1": float(f1)}

def compute_metrics(prediction: str, reference: str, metrics: List[str], options: Dict = None) -> Dict[str, float]:
    options = options or {}
    out: Dict[str, float] = {}
    mset = set(m.lower() for m in metrics)

    if "em" in mset or "exact match" in mset:
        out["em"] = exact_match(prediction, reference)

    if "bleu" in mset:
        out["bleu"] = bleu_score(prediction, reference)

    if "rouge" in mset:
        out.update(rouge_score(prediction, reference))

    if "bertscore" in mset:
        out.update(bertscore_score(prediction, reference))

    if "perplexity" in mset:
        model_for_ppl = options.get("perplexity_model", "gpt2")
        out["perplexity"] = perplexity_score(prediction, model_for_ppl)

    if any(x in mset for x in ["accuracy","precision","recall","f1"]):
        out.update(prf1_accuracy_token(prediction, reference))

    # Optional “averages” flags (UI can toggle; here we just echo the same values
    # since we compute a single example. When you batch, compute true averages.)
    if options.get("avg_em"): out["em_avg"] = out.get("em", 0.0)
    if options.get("avg_accuracy"): out["accuracy_avg"] = out.get("accuracy", 0.0)
    if options.get("avg_precision"): out["precision_avg"] = out.get("precision", 0.0)
    if options.get("avg_recall"): out["recall_avg"] = out.get("recall", 0.0)

    return out

def test_metrics_accuracy():
    """
    Test function to validate metrics are working correctly with known inputs.
    This helps ensure the metrics are producing reasonable results.
    """
    print("Testing metrics accuracy...")
    
    # Test case 1: Identical texts
    pred1 = "The quick brown fox jumps over the lazy dog."
    ref1 = "The quick brown fox jumps over the lazy dog."
    
    # Test case 2: Similar but different texts
    pred2 = "The quick brown fox jumps over the lazy dog."
    ref2 = "A quick brown fox jumps over a lazy dog."
    
    # Test case 3: Very different texts
    pred3 = "Hello world"
    ref3 = "The quick brown fox jumps over the lazy dog."
    
    test_cases = [
        ("Identical", pred1, ref1),
        ("Similar", pred2, ref2), 
        ("Different", pred3, ref3)
    ]
    
    for name, pred, ref in test_cases:
        print(f"\n--- {name} Test Case ---")
        print(f"Prediction: {pred}")
        print(f"Reference: {ref}")
        
        # Test all metrics
        metrics = ["em", "bleu", "rouge", "bertscore", "accuracy", "precision", "recall", "f1"]
        results = compute_metrics(pred, ref, metrics)
        
        for metric, score in results.items():
            print(f"{metric}: {score:.4f}")
            
        # Validate expected behavior
        if name == "Identical":
            assert results["em"] == 1.0, f"Exact match should be 1.0 for identical texts, got {results['em']}"
            assert results["rouge1"] > 0.9, f"ROUGE-1 should be high for identical texts, got {results['rouge1']}"
        elif name == "Similar":
            assert results["rouge1"] > 0.5, f"ROUGE-1 should be moderate for similar texts, got {results['rouge1']}"
        elif name == "Different":
            assert results["rouge1"] < 0.3, f"ROUGE-1 should be low for different texts, got {results['rouge1']}"
    
    print("\nAll metric tests passed!")

if __name__ == "__main__":
    test_metrics_accuracy()
