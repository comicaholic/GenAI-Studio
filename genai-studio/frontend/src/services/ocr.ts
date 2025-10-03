// frontend/src/services/ocr.ts
import { api } from "@/services/api";

export interface OCRExtractResponse {
  file_id: string;
  filename: string;
  text: string;
  pages: string[];
  page_count: number;
}

export async function extractOCR(file: File): Promise<OCRExtractResponse> {
  const form = new FormData();
  form.append("file", file, file.name);   // field must be "file"

  // NOTE: pass the FormData via init.body; leave the 'body' param undefined
  const res = await api.post<OCRExtractResponse>("/ocr/extract", undefined, {
    init: { body: form },
  });
  return res.data;
}
