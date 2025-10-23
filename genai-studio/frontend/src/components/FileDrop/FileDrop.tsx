import React, { useCallback, useRef, useState } from "react";
type Props = {
  onFile?: (file: File) => void;
  onFiles?: (files: File[]) => void;          // NEW
  accept?: string;
  label?: string;
  multiple?: boolean;                          // NEW
};

export default function FileDrop({ onFile, onFiles, accept, label="Drop file or click", multiple=false }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [drag, setDrag] = React.useState(false);

  const handle = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    if (multiple && onFiles) onFiles(arr);
    else if (onFile) onFile(arr[0]);
  };

  return (
    <div
      onDragOver={(e)=>{e.preventDefault(); setDrag(true);}}
      onDragLeave={()=>setDrag(false)}
      onDrop={(e)=>{e.preventDefault(); setDrag(false); handle(e.dataTransfer.files);}}
      onClick={()=>inputRef.current?.click()}
      style={{
        border: "2px dashed #334155",
        borderColor: drag ? "#60a5fa" : "#334155",
        padding: 12,
        borderRadius: 8,
        textAlign: "center",
        cursor: "pointer",
        userSelect: "none",
        background: "#1e293b",
      }}
      title={accept}
    >
      <div style={{fontSize:14, color:"#e2e8f0"}}>{label}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}                         // NEW
        onChange={(e)=>handle(e.target.files)}
        style={{ display: "none" }}
      />
    </div>
  );
}

