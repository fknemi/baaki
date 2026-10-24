import { S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.R2_ENDPOINT_URL;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME;

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
  throw new Error(
    "Missing R2 config: R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME",
  );
}

// Local dev uses SeaweedFS at http://localhost:8333 (or a LAN IP).
// Hosted deployments use Cloudflare R2 at
// https://<account-id>.r2.cloudflarestorage.com.
const isCloudflareR2 = endpoint.includes("r2.cloudflarestorage.com");

// VERCEL is injected automatically by the platform. Any Vercel-hosted
// environment (production OR preview) must use R2 — SeaweedFS isn't
// reachable from Vercel's edge, and shipping it would 500 every upload.
const isVercelHosted = process.env.VERCEL === "1";

if (isVercelHosted && !isCloudflareR2) {
  throw new Error(
    `Hosted deployment requires Cloudflare R2. R2_ENDPOINT_URL="${endpoint}" does not contain "r2.cloudflarestorage.com". ` +
      "Set R2_ENDPOINT_URL to https://<account-id>.r2.cloudflarestorage.com in your Vercel environment variables.",
  );
}

export const s3 = new S3Client({
  // R2 requires region "auto" (Cloudflare-specific). SeaweedFS defaults to
  // us-east-1 and rejects "auto" with a signature mismatch.
  region: isCloudflareR2 ? "auto" : "us-east-1",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  // Both R2 and SeaweedFS support path-style addressing. Keeping it on for
  // both means presigned URLs behave identically across environments and
  // avoids a class of virtual-hosted CORS bugs that are hard to debug on R2.
  forcePathStyle: true,
  // Disable SDK v3 auto-checksums on presigned PUTs. Without this,
  // SeaweedFS (and some R2 configurations) reject with
  // XAmzContentChecksumMismatch because the checksum is computed on an
  // empty body at presign time but validated against the real body at
  // PUT time.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const BUCKET = bucket;

// Exported for startup logging — useful to confirm which backend is
// active when you deploy (e.g. log this in instrumentation.ts).
export const STORAGE_BACKEND = isCloudflareR2 ? "cloudflare-r2" : "seaweedfs";
