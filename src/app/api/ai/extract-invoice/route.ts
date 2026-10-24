import { NextRequest, NextResponse } from "next/server";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { requireRole } from "@/lib/auth/require-role";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { getGenai, MODEL } from "@/lib/integrations/gemini";
import { isValidGSTIN } from "@/lib/domain/gstin";
import { computeTotals } from "@/lib/domain/gst";


const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const EXTRACT_PROMPT = `You are an OCR engine for Indian GST invoices. Extract these fields as JSON. If a field is not visible, use null. Prices are in rupees; convert to integer paise by multiplying by 100.

Schema:
{
  "invoiceNumber": string | null,
  "invoiceDate": "YYYY-MM-DD" | null,
  "dueDate": "YYYY-MM-DD" | null,
  "customerName": string | null,
  "gstin": string | null,
  "items": [
    {
      "description": string,
      "hsnSac": string,
      "qty": number,
      "unit": string,
      "ratePaise": number,
      "gstRatePct": number
    }
  ],
  "taxablePaise": number | null,
  "totalPaise": number | null
}

Return only the JSON, no other text.`;

export async function POST(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      const body = (await req.json().catch(() => ({}))) as {
        storageKey?: string;
      };
      const storageKey = String(body.storageKey ?? "");
      if (!storageKey) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "storageKey required" } },
          { status: 400 },
        );
      }

      const { allowed } = await checkRateLimit(ctx.userId, "ocr", 20);
      if (!allowed) {
        return NextResponse.json(
          { error: { code: "RATE_LIMITED", message: "20 scans/hour. Try again later." } },
          { status: 429 },
        );
      }

      const bucket = process.env.R2_BUCKET_NAME!;
      let bytes: Uint8Array;
      let mime = "image/jpeg";
      try {
        const obj = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
        );
        if (!obj.Body) throw new Error("empty");
        bytes = await obj.Body.transformToByteArray();
        mime = obj.ContentType ?? mime;
      } catch (err) {
        console.error("[ai:ocr] fetch failed:", err);
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "File not found" } },
          { status: 404 },
        );
      }

      const cleanup = () =>
        s3
          .send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }))
          .catch((err) => console.error("[ai:ocr] cleanup failed:", err));

      let extracted: Record<string, unknown> = {};
      try {
        const resp = await getGenai().models.generateContent({
          model: MODEL,
          contents: [
            {
              role: "user",
              parts: [
                { text: EXTRACT_PROMPT },
                {
                  inlineData: {
                    mimeType: mime,
                    data: Buffer.from(bytes).toString("base64"),
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });
        extracted = JSON.parse(resp.text ?? "{}");
      } catch (err) {
        console.error("[ai:ocr] Gemini call failed:", err);
        await cleanup();
        return NextResponse.json(
          { error: { code: "INTERNAL", message: "Extraction failed" } },
          { status: 500 },
        );
      }

      await cleanup();

      const flags: string[] = [];
      const gstin = typeof extracted.gstin === "string" ? extracted.gstin : null;
      if (gstin && !isValidGSTIN(gstin).valid) {
        flags.push("invalid_gstin");
      }

      const items = Array.isArray(extracted.items)
        ? (extracted.items as Array<Record<string, number | string>>)
        : [];
      if (items.length > 0) {
        const computedTotals = computeTotals(
          items.map((it) => ({
            qty: Number(it.qty ?? 0),
            ratePaise: Number(it.ratePaise ?? 0),
            discountPaise: 0,
            gstRatePct: Number(it.gstRatePct ?? 0),
          })),
          { stateCode: "27", registrationType: "regular" },
          { stateCode: "27" },
        );
        const reportedTotal = Number(extracted.totalPaise ?? 0);
        if (
          reportedTotal > 0 &&
          Math.abs(computedTotals.totalPaise - reportedTotal) > 100
        ) {
          flags.push(
            `total_mismatch: computed=${computedTotals.totalPaise} reported=${reportedTotal}`,
          );
        }
      }

      return NextResponse.json({ data: { extracted, flags } });
    },
    ["owner", "accountant"],
  );
}
