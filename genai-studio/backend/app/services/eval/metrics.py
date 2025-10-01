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
        res = rouge.compute(predictions=[pred], references=[ref])
        # keep a few common keys
        return {k: float(res.get(k, 0.0)) for k in ["rouge1", "rouge2", "rougeL", "rougeLsum"]}
    except Exception as e:
        print(f"ROUGE score error: {e}")
        return {"rouge1": 0.0, "rouge2": 0.0, "rougeL": 0.0, "rougeLsum": 0.0}

def bertscore_score(pred: str, ref: str) -> Dict[str, float]:
    if not pred.strip() or not ref.strip():
        return {"bertscore_precision": 0.0, "bertscore_recall": 0.0, "bertscore_f1": 0.0}
    try:
        bert = evaluate.load("bertscore")
        res = bert.compute(predictions=[pred], references=[ref], lang="en")
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
    ppl = evaluate.load("perplexity", module_type="measurement")
    res = ppl.compute(model_id=model_id, add_start_token=True, data=[pred])
    return float(np.mean(res["perplexities"]))

def prf1_accuracy_token(pred: str, ref: str) -> Dict[str, float]:
    """
    Token-level classification: treat each token as a label; match by position.
    This is a pragmatic way to expose HF/Sklearn metrics on text without gold labels.
    """
    p = _tok(pred); r = _tok(ref)
    n = max(len(p), len(r))
    p += [""] * (n - len(p))
    r += [""] * (n - len(r))
    y_true = [1 if r[i] == r[i] else 1 for i in range(n)]       # all valid positions
    y_pred = [1 if p[i] == r[i] else 0 for i in range(n)]
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
