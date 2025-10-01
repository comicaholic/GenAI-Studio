import React from "react";

export type ModelParams = { max_tokens: number; temperature: number; top_p: number; top_k: number; };

export default function ParamsPanel({
  params, onChange
}: { params: ModelParams; onChange: (p: ModelParams) => void; }) {
  const s = (k: keyof ModelParams, v: number) => onChange({ ...params, [k]: v });

  return (
    <div>
      <h3 style={{marginTop:0}}>Model Parameters</h3>
      <label style={{display:"block", fontSize:12, margin:"8px 0 4px"}}>Max tokens: {params.max_tokens}</label>
      <input type="range" min={64} max={4096} step={64} value={params.max_tokens} onChange={e=>s("max_tokens", Number(e.target.value))} style={{width:"100%"}} />

      <label style={{display:"block", fontSize:12, margin:"8px 0 4px"}}>Temperature: {params.temperature.toFixed(2)}</label>
      <input type="range" min={0} max={2} step={0.05} value={params.temperature} onChange={e=>s("temperature", Number(e.target.value))} style={{width:"100%"}} />

      <label style={{display:"block", fontSize:12, margin:"8px 0 4px"}}>Top P: {params.top_p.toFixed(2)}</label>
      <input type="range" min={0} max={1} step={0.01} value={params.top_p} onChange={e=>s("top_p", Number(e.target.value))} style={{width:"100%"}} />

      <label style={{display:"block", fontSize:12, margin:"8px 0 4px"}}>Top K: {params.top_k}</label>
      <input type="range" min={0} max={200} step={1} value={params.top_k} onChange={e=>s("top_k", Number(e.target.value))} style={{width:"100%"}} />
    </div>
  );
}
