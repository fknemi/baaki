import "server-only";
import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

export function getGenai(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY required");
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

export const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
export const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 15000);
