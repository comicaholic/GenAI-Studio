import React from "react";
import { HFItem, searchHF } from "@/services/models";
import { api } from "@/services/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (id: string) => Promise<void>;
};

export default function DiscoverModal({ open, onClose, onAdd }: Props) {
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<"downloads"|"likes"|"recent">("downloads");
  const [results, setResults] = React.useState<HFItem[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hfTokenStatus, setHfTokenStatus] = React.useState<{hasToken: boolean, connected: boolean}>({hasToken: false, connected: false});

  React.useEffect(() => {
    if (!open) {
      setQ(""); setResults([]); setError(null);
    } else {
      // Check Hugging Face token status when modal opens
      checkHfTokenStatus();
    }
  }, [open]);

  const checkHfTokenStatus = async () => {
    try {
      const res = await api.get("/settings/settings");
      const hfSettings = res.data?.huggingface || {};
      setHfTokenStatus({
        hasToken: Boolean(hfSettings.token && hfSettings.token.trim()),
        connected: Boolean(hfSettings.connected)
      });
    } catch (err) {
      console.warn("Failed to check HF token status:", err);
      setHfTokenStatus({hasToken: false, connected: false});
    }
  };

  if (!open) return null;

  const runSearch = async () => {
    setBusy(true); setError(null);
    try {
      const res = await searchHF(q, sort, 50);
      setResults(res);
    } catch (e:any) {
      setError(e?.response?.data || e.message || String(e));
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000
    }}>
      <div style={{
        width:"min(1100px, 96vw)", height:"min(680px, 92vh)",
        background:"#0b1220", color:"#e2e8f0",
        border:"1px solid #1f2937", borderRadius:12, display:"grid",
        gridTemplateRows:"auto 1fr", boxShadow:"0 20px 60px rgba(0,0,0,.55)"
      }}>
        {/* Header */}
        <div style={{display:"flex", gap:12, alignItems:"center", padding:"10px 12px", borderBottom:"1px solid #1f2937"}}>
          <strong style={{fontSize:16}}>Discover Models (Hugging Face)</strong>
          <input
            placeholder="Search models on HF…"
            value={q}
            onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>e.key==="Enter" && runSearch()}
            style={{flex:1, padding:"8px 10px", border:"1px solid #334155", borderRadius:8, background:"#0f172a", color:"#e2e8f0"}}
          />
          <select value={sort} onChange={e=>setSort(e.target.value as any)} style={{padding:"8px 10px", border:"1px solid #334155", borderRadius:8, background:"#0f172a", color:"#e2e8f0"}}>
            <option value="downloads">Best Match / Downloads</option>
            <option value="likes">Likes</option>
            <option value="recent">Recent</option>
          </select>
          <button onClick={runSearch} style={{padding:"8px 12px"}}>Search</button>
          <button onClick={onClose} style={{marginLeft:6, padding:"8px 12px"}}>Close</button>
        </div>

        {/* Body */}
        <div style={{overflow:"auto"}}>
          {/* Hugging Face Token Warning */}
          {!hfTokenStatus.hasToken && (
            <div style={{
              padding: "16px",
              margin: "12px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              border: "1px solid #f59e0b",
              borderRadius: "8px",
              color: "#ffffff"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2M12,4.5L11.5,7.5L8.5,8L11.5,8.5L12,11.5L12.5,8.5L15.5,8L12.5,7.5L12,4.5Z"/>
                </svg>
                <strong style={{ fontSize: "14px" }}>Hugging Face Token Required</strong>
              </div>
              <div style={{ fontSize: "13px", lineHeight: "1.4", marginBottom: "8px" }}>
                To discover and add models from Hugging Face, you need to configure your access token first.
              </div>
              <div style={{ fontSize: "12px", opacity: "0.9" }}>
                Go to Settings → Hugging Face to add your token from{" "}
                <a 
                  href="https://huggingface.co/settings/tokens" 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ color: "#ffffff", textDecoration: "underline" }}
                >
                  huggingface.co/settings/tokens
                </a>
              </div>
            </div>
          )}
          
          {busy && <div style={{padding:12, color:"#a3a3a3"}}>Searching…</div>}
          {error && <div style={{padding:12, color:"#fca5a5"}}>{String(error)}</div>}
          {!busy && !error && results.length === 0 && (
            <div style={{padding:16, color:"#9ca3af"}}>Type a query (e.g. <code>llama</code>, <code>mistral</code>, <code>qwen</code>) and press Search.</div>
          )}

          {results.length > 0 && (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{background:"#0f172a"}}>
                  <th style={th}>Model</th>
                  <th style={th}>Publisher</th>
                  <th style={th}>Downloads</th>
                  <th style={th}>Likes</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id} style={{borderTop:"1px solid #1f2937"}}>
                    <td style={td}>
                      <div style={{display:"flex", alignItems:"center", gap:8}}>
                        <span style={{fontWeight:600}}>{r.id}</span>
                        {chipFromTags(r.tags)}
                      </div>
                    </td>
                    <td style={td}>{r.author ?? "-"}</td>
                    <td style={{...td, textAlign:"center"}}>{r.downloads ?? "-"}</td>
                    <td style={{...td, textAlign:"center"}}>{r.likes ?? "-"}</td>
                    <td style={{...td, textAlign:"right"}}>
                      <button onClick={() => onAdd(r.id)} style={{padding:"6px 10px"}}>Add</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign:"left", padding:"10px 12px", borderBottom:"1px solid #1f2937", fontWeight:600 };
const td: React.CSSProperties = { padding:"10px 12px", verticalAlign:"middle" };

function chipFromTags(tags?: string[]) {
  if (!tags || !tags.length) return null;
  // Try to surface a couple of recognizable tags like arch or quant
  const arch = tags.find(t=>/(llama|qwen|mistral|gemma|gpt-oss|mixtral|deepspeed|deepseek)/i);
  const quant = tags.find(t=>/^q\d.*|gguf|gptq|mlx$/i);
  const pills = [arch, quant].filter(Boolean).slice(0,3) as string[];
  if (!pills.length) return null;

  return (
    <div style={{display:"flex", gap:6}}>
      {pills.map(p => (
        <span key={p} style={{
          fontSize:11, padding:"2px 6px", borderRadius:8,
          border:"1px solid #374151", background:"#0f172a", color:"#cbd5e1"
        }}>{p}</span>
      ))}
    </div>
  );
}
