// frontend/src/components/ui/ModelTags.tsx
import React, { useState } from "react";

interface TagProps {
  children: React.ReactNode;
  tooltip?: string;
  variant?: "quantization" | "architecture" | "format" | "config" | "default";
  className?: string;
}

export function Tag({ children, tooltip, variant = "default", className = "" }: TagProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getVariantStyles = () => {
    switch (variant) {
      case "quantization":
        return "bg-gray-600 text-gray-200 text-xs px-2 py-1 rounded";
      case "architecture":
        return "bg-green-600 text-green-100 text-xs px-2 py-1 rounded";
      case "format":
        return "bg-blue-600 text-blue-100 text-xs px-2 py-1 rounded";
      case "config":
        return "bg-purple-600 text-purple-100 text-xs px-2 py-1 rounded";
      default:
        return "bg-gray-600 text-gray-200 text-xs px-2 py-1 rounded";
    }
  };

  return (
    <div className="relative inline-block">
      <span
        className={`${getVariantStyles()} ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
      </span>
      {tooltip && showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 whitespace-nowrap">
          {tooltip}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}

interface IconTagProps {
  icon: React.ReactNode;
  tooltip: string;
  variant?: "config" | "preview" | "default";
  className?: string;
}

export function IconTag({ icon, tooltip, variant = "default", className = "" }: IconTagProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getVariantStyles = () => {
    switch (variant) {
      case "config":
        return "text-blue-400 hover:text-blue-300";
      case "preview":
        return "text-yellow-400 hover:text-yellow-300";
      default:
        return "text-gray-400 hover:text-gray-300";
    }
  };

  return (
    <div className="relative inline-block">
      <div
        className={`cursor-pointer transition-colors ${getVariantStyles()} ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {icon}
      </div>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 whitespace-nowrap">
          {tooltip}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}

// Specific tag components for common model properties
export function QuantizationTag({ quant }: { quant: string }) {
  const getTooltip = (q: string) => {
    const quantMap: Record<string, string> = {
      "Q4_K_S": "4-bit quantization, small (fastest, lowest quality)",
      "Q4_K_M": "4-bit quantization, medium (balanced speed/quality)",
      "Q4_K_L": "4-bit quantization, large (slower, better quality)",
      "Q5_K_S": "5-bit quantization, small",
      "Q5_K_M": "5-bit quantization, medium",
      "Q6_K": "6-bit quantization (higher quality)",
      "Q8_0": "8-bit quantization (highest quality)",
      "FP16": "16-bit floating point (full precision)",
      "FP32": "32-bit floating point (maximum precision)",
      "MXFP4": "Mixed precision 4-bit quantization",
      "int4": "4-bit integer quantization",
      "int8": "8-bit integer quantization",
    };
    return quantMap[q] || `Quantization method: ${q}`;
  };

  return <Tag variant="quantization" tooltip={getTooltip(quant)}>{quant}</Tag>;
}

export function ArchitectureTag({ arch }: { arch: string }) {
  const getTooltip = (a: string) => {
    const archMap: Record<string, string> = {
      "LLaMA": "Meta's Large Language Model Architecture",
      "Mistral/Mixtral": "Mistral AI's transformer architecture",
      "Qwen": "Alibaba's Qwen model architecture",
      "Gemma": "Google's Gemma model architecture",
      "Phi": "Microsoft's Phi model architecture",
      "GPT": "OpenAI's Generative Pre-trained Transformer",
      "Claude": "Anthropic's Claude model architecture",
      "CodeStral": "Mistral's code-specialized architecture",
      "DeepSeek": "DeepSeek's model architecture",
    };
    return archMap[a] || `Model architecture: ${a}`;
  };

  return <Tag variant="architecture" tooltip={getTooltip(arch)}>{arch}</Tag>;
}

export function FormatTag({ format }: { format: string }) {
  const getTooltip = (f: string) => {
    const formatMap: Record<string, string> = {
      "GGUF": "GGML Universal Format - optimized for CPU inference",
      "GGML": "GGML format for efficient inference",
      "Safetensors": "SafeTensors format for secure model storage",
      "PyTorch": "PyTorch model format",
      "ONNX": "Open Neural Network Exchange format",
    };
    return formatMap[f] || `Model format: ${f}`;
  };

  return <Tag variant="format" tooltip={getTooltip(format)}>{format}</Tag>;
}

export function ConfigIcon() {
  return (
    <IconTag
      variant="config"
      tooltip="Model has configurable settings"
      icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
        </svg>
      }
    />
  );
}

export function PreviewIcon() {
  return (
    <IconTag
      variant="preview"
      tooltip="Model preview available"
      icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z" />
        </svg>
      }
    />
  );
}


