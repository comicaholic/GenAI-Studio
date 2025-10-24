import React from "react";

export type MetricState = {
  rouge: boolean; bleu: boolean; f1: boolean; em: boolean; em_avg: boolean;
  bertscore: boolean; perplexity: boolean; accuracy: boolean; accuracy_avg: boolean;
  precision: boolean; precision_avg: boolean; recall: boolean; recall_avg: boolean;
};

export const DEFAULT_METRICS: MetricState = {
  rouge:true, bleu:true, f1:true, em:false, em_avg:false,
  bertscore:false, perplexity:false, accuracy:false, accuracy_avg:false,
  precision:false, precision_avg:false, recall:false, recall_avg:false,
};


export default function MetricsPanel(props: {
  metrics?: MetricState;              // preferred
  state?: MetricState;                // legacy alias
  onChange: (next: MetricState) => void;
}) {
  const metrics = (props.metrics ?? props.state) ?? DEFAULT_METRICS;
  const { onChange } = props;
  const ck = (k: keyof MetricState) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...metrics, [k]: e.target.checked });

  return (
    <div>
      <h3 style={{ color: "#e2e8f0" }}>Metrics</h3>
      <div style={{display:"grid", gap:6}}>
        <label style={{ color: "#e2e8f0" }}><input type="checkbox" checked={metrics.rouge} onChange={ck("rouge")} /> ROUGE</label>
        <label style={{ color: "#e2e8f0" }}><input type="checkbox" checked={metrics.bleu} onChange={ck("bleu")} /> BLEU</label>
        <label style={{ color: "#e2e8f0" }}><input type="checkbox" checked={metrics.f1} onChange={ck("f1")} /> F1 score</label>

        <label style={{ color: "#e2e8f0" }}><input type="checkbox" checked={metrics.em} onChange={ck("em")} /> Exact Match (EM)</label>
        <label style={{marginLeft:18, fontSize:12, color:"#94a3b8"}}><input type="checkbox" checked={metrics.em_avg} onChange={ck("em_avg")} /> average EM</label>

        <label style={{ color: "#e2e8f0" }}><input type="checkbox" checked={metrics.bertscore} onChange={ck("bertscore")} /> BERTScore</label>
        <label style={{ color: "#e2e8f0" }}><input type="checkbox" checked={metrics.perplexity} onChange={ck("perplexity")} /> Perplexity</label>

        <label style={{ color: "#e2e8f0" }}><input type="checkbox" checked={metrics.accuracy} onChange={ck("accuracy")} /> Accuracy</label>
        <label style={{marginLeft:18, fontSize:12, color:"#94a3b8"}}><input type="checkbox" checked={metrics.accuracy_avg} onChange={ck("accuracy_avg")} /> average accuracy</label>

        <label style={{ color: "#e2e8f0" }}><input type="checkbox" checked={metrics.precision} onChange={ck("precision")} /> Precision</label>
        <label style={{marginLeft:18, fontSize:12, color:"#94a3b8"}}><input type="checkbox" checked={metrics.precision_avg} onChange={ck("precision_avg")} /> average precision</label>

        <label style={{ color: "#e2e8f0" }}><input type="checkbox" checked={metrics.recall} onChange={ck("recall")} /> Recall</label>
        <label style={{marginLeft:18, fontSize:12, color:"#94a3b8"}}><input type="checkbox" checked={metrics.recall_avg} onChange={ck("recall_avg")} /> average recall</label>
      </div>
    </div>
  );
}