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

def compute_character_metrics(pred: str, ref: str) -> Dict[str, float]:
    """
    Character-level metrics: compare each character position by position.
    This provides more granular comparison for text similarity.
    """
    pred_chars = list(pred)
    ref_chars = list(ref)
    
    # Handle empty cases
    if not pred_chars and not ref_chars:
        return {"char_accuracy": 1.0, "char_precision": 1.0, "char_recall": 1.0, "char_f1": 1.0}
    if not pred_chars or not ref_chars:
        return {"char_accuracy": 0.0, "char_precision": 0.0, "char_recall": 0.0, "char_f1": 0.0}
    
    # Pad shorter array to match length
    max_len = max(len(pred_chars), len(ref_chars))
    pred_padded = pred_chars + [''] * (max_len - len(pred_chars))
    ref_padded = ref_chars + [''] * (max_len - len(ref_chars))
    
    # Calculate character matches
    tp = fp = fn = 0
    for p, r in zip(pred_padded, ref_padded):
        if p == r and p != '':
            tp += 1
        elif p != '' and r == '':
            fp += 1
        elif p == '' and r != '':
            fn += 1
    
    # Calculate metrics
    accuracy = tp / max_len if max_len > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    return {
        "char_accuracy": float(accuracy),
        "char_precision": float(precision),
        "char_recall": float(recall),
        "char_f1": float(f1)
    }

def compute_word_metrics(pred: str, ref: str) -> Dict[str, float]:
    """
    Word-level metrics: compare each word position by position.
    This provides word-level granularity for text similarity.
    """
    pred_words = _tok(pred)
    ref_words = _tok(ref)
    
    # Handle empty cases
    if not pred_words and not ref_words:
        return {"word_accuracy": 1.0, "word_precision": 1.0, "word_recall": 1.0, "word_f1": 1.0}
    if not pred_words or not ref_words:
        return {"word_accuracy": 0.0, "word_precision": 0.0, "word_recall": 0.0, "word_f1": 0.0}
    
    # Pad shorter sequence with empty strings
    max_len = max(len(pred_words), len(ref_words))
    pred_padded = pred_words + [''] * (max_len - len(pred_words))
    ref_padded = ref_words + [''] * (max_len - len(ref_words))
    
    # Calculate word matches
    tp = fp = fn = 0
    for p, r in zip(pred_padded, ref_padded):
        if p == r and p != '':
            tp += 1
        elif p != '' and r == '':
            fp += 1
        elif p == '' and r != '':
            fn += 1
    
    # Calculate metrics
    accuracy = tp / max_len if max_len > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    return {
        "word_accuracy": float(accuracy),
        "word_precision": float(precision),
        "word_recall": float(recall),
        "word_f1": float(f1)
    }

def prf1_accuracy_token(pred: str, ref: str) -> Dict[str, float]:
    """
    Legacy token-level classification: treat each character as a label; match by position.
    This is kept for backward compatibility but now uses character-level metrics for more precise evaluation.
    """
    char_metrics = compute_character_metrics(pred, ref)
    return {
        "accuracy": char_metrics["char_accuracy"],
        "precision": char_metrics["char_precision"],
        "recall": char_metrics["char_recall"],
        "f1": char_metrics["char_f1"]
    }

def compute_metrics(prediction: str, reference: str, metrics: List[str], options: Dict = None) -> Dict[str, float]:
    options = options or {}
    out: Dict[str, float] = {}
    mset = set(m.lower() for m in metrics)

    # Traditional metrics
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

    # Word-level metrics (legacy compatibility)
    if any(x in mset for x in ["accuracy","precision","recall","f1"]):
        out.update(prf1_accuracy_token(prediction, reference))

    # Character-level metrics
    if any(x in mset for x in ["char_accuracy","char_precision","char_recall","char_f1"]):
        char_metrics = compute_character_metrics(prediction, reference)
        out.update(char_metrics)

    # Word-level metrics (explicit)
    if any(x in mset for x in ["word_accuracy","word_precision","word_recall","word_f1"]):
        word_metrics = compute_word_metrics(prediction, reference)
        out.update(word_metrics)

    # Character-level exact match
    if "char_em" in mset or "character_exact_match" in mset:
        char_em = 1.0 if prediction.strip() == reference.strip() else 0.0
        out["char_em"] = char_em

    # Handle averaging flags - these are used when computing batch averages
    # For single evaluations, we just echo the same values
    if options.get("avg_em"): 
        out["em_avg"] = out.get("em", 0.0)
    if options.get("avg_accuracy"): 
        out["accuracy_avg"] = out.get("accuracy", 0.0)
    if options.get("avg_precision"): 
        out["precision_avg"] = out.get("precision", 0.0)
    if options.get("avg_recall"): 
        out["recall_avg"] = out.get("recall", 0.0)
    if options.get("avg_char_accuracy"): 
        out["char_accuracy_avg"] = out.get("char_accuracy", 0.0)
    if options.get("avg_char_precision"): 
        out["char_precision_avg"] = out.get("char_precision", 0.0)
    if options.get("avg_char_recall"): 
        out["char_recall_avg"] = out.get("char_recall", 0.0)
    if options.get("avg_word_accuracy"): 
        out["word_accuracy_avg"] = out.get("word_accuracy", 0.0)
    if options.get("avg_word_precision"): 
        out["word_precision_avg"] = out.get("word_precision", 0.0)
    if options.get("avg_word_recall"): 
        out["word_recall_avg"] = out.get("word_recall", 0.0)

    return out

def compute_batch_averages(evaluation_results: List[Dict[str, float]]) -> Dict[str, float]:
    """
    Compute true averages across multiple evaluation results.
    This is used when you have multiple predictions and references to evaluate.
    
    Args:
        evaluation_results: List of metric dictionaries from individual evaluations
        
    Returns:
        Dictionary with averaged metrics
    """
    if not evaluation_results:
        return {}
    
    # Collect all metric names
    all_metrics = set()
    for result in evaluation_results:
        all_metrics.update(result.keys())
    
    # Compute averages
    averages = {}
    for metric in all_metrics:
        values = [result.get(metric, 0.0) for result in evaluation_results if metric in result]
        if values:
            averages[f"{metric}_avg"] = sum(values) / len(values)
    
    return averages

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
    
    # Test case 4: Character-level differences
    pred4 = "Hello world"
    ref4 = "Hello worl"  # One character difference at the end
    
    test_cases = [
        ("Identical", pred1, ref1),
        ("Similar", pred2, ref2), 
        ("Different", pred3, ref3),
        ("Character_diff", pred4, ref4)
    ]
    
    for name, pred, ref in test_cases:
        print(f"\n--- {name} Test Case ---")
        print(f"Prediction: {pred}")
        print(f"Reference: {ref}")
        
        # Test all metrics including new character and word level metrics
        metrics = [
            "em", "bleu", "rouge", "bertscore", "accuracy", "precision", "recall", "f1",
            "char_accuracy", "char_precision", "char_recall", "char_f1",
            "word_accuracy", "word_precision", "word_recall", "word_f1",
            "char_em"
        ]
        results = compute_metrics(pred, ref, metrics)
        
        for metric, score in results.items():
            print(f"{metric}: {score:.4f}")
            
        # Validate expected behavior
        if name == "Identical":
            assert results["em"] == 1.0, f"Exact match should be 1.0 for identical texts, got {results['em']}"
            assert results["char_em"] == 1.0, f"Character exact match should be 1.0 for identical texts, got {results['char_em']}"
            assert results["char_accuracy"] == 1.0, f"Character accuracy should be 1.0 for identical texts, got {results['char_accuracy']}"
            assert results["word_accuracy"] == 1.0, f"Word accuracy should be 1.0 for identical texts, got {results['word_accuracy']}"
            assert results["rouge1"] > 0.9, f"ROUGE-1 should be high for identical texts, got {results['rouge1']}"
        elif name == "Similar":
            assert results["rouge1"] > 0.5, f"ROUGE-1 should be moderate for similar texts, got {results['rouge1']}"
            assert results["word_accuracy"] > 0.5, f"Word accuracy should be moderate for similar texts, got {results['word_accuracy']}"
        elif name == "Different":
            assert results["rouge1"] < 0.3, f"ROUGE-1 should be low for different texts, got {results['rouge1']}"
            assert results["word_accuracy"] < 0.3, f"Word accuracy should be low for different texts, got {results['word_accuracy']}"
        elif name == "Character_diff":
            assert results["char_accuracy"] > 0.8, f"Character accuracy should be high for single character difference, got {results['char_accuracy']}"
            assert results["word_accuracy"] > 0.4, f"Word accuracy should be moderate for single character difference, got {results['word_accuracy']}"
    
    print("\nAll metric tests passed!")

if __name__ == "__main__":
    test_metrics_accuracy()
