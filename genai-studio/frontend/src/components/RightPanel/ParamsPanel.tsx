import React from "react";

export type ModelParams = {
  max_tokens: number;
  temperature: number;
  top_p: number;
  top_k: number;
};

export const DEFAULT_PARAMS: ModelParams = {
  temperature: 0.7,
  max_tokens: 1024,
  top_p: 1.0,
  top_k: 40,
};

type Props = {
  params?: Partial<ModelParams> | ModelParams;
  onChange: (p: ModelParams) => void;
};

export default function ParamsPanel({ params, onChange }: Props) {
  // Merge with defaults and coerce to numbers
  const safe: ModelParams = {
    max_tokens: Number.isFinite(Number(params?.max_tokens)) ? Number(params!.max_tokens) : DEFAULT_PARAMS.max_tokens,
    temperature: Number.isFinite(Number(params?.temperature)) ? Number(params!.temperature) : DEFAULT_PARAMS.temperature,
    top_p: Number.isFinite(Number(params?.top_p)) ? Number(params!.top_p) : DEFAULT_PARAMS.top_p,
    top_k: Number.isFinite(Number(params?.top_k)) ? Number(params!.top_k) : DEFAULT_PARAMS.top_k,
  };

  const setKey = (k: keyof ModelParams, v: number) => onChange({ ...safe, [k]: v });

  return (
    <div style={{ padding: 8 }}>
      <h3 style={{ margin: "0 0 8px 0" }}>Model Parameters</h3>

      <label style={{ display: "block", fontSize: 12, margin: "8px 0 4px" }}>
        Max tokens: {safe.max_tokens}
      </label>
      <input
        type="range"
        min={64}
        max={4096}
        step={64}
        value={safe.max_tokens}
        onChange={(e) => setKey("max_tokens", Number(e.target.value))}
        style={{ width: "100%" }}
      />

      <label style={{ display: "block", fontSize: 12, margin: "8px 0 4px" }}>
        Temperature: {safe.temperature.toFixed(2)}
      </label>
      <input
        type="range"
        min={0}
        max={2}
        step={0.05}
        value={safe.temperature}
        onChange={(e) => setKey("temperature", Number(e.target.value))}
        style={{ width: "100%" }}
      />

      <label style={{ display: "block", fontSize: 12, margin: "8px 0 4px" }}>
        Top P: {safe.top_p.toFixed(2)}
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={safe.top_p}
        onChange={(e) => setKey("top_p", Number(e.target.value))}
        style={{ width: "100%" }}
      />

      <label style={{ display: "block", fontSize: 12, margin: "8px 0 4px" }}>Top K: {safe.top_k}</label>
      <input
        type="range"
        min={0}
        max={200}
        step={1}
        value={safe.top_k}
        onChange={(e) => setKey("top_k", Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}
