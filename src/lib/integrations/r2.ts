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

export const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
  // Newer @aws-sdk/client-s3 versions add a checksum to presigned URLs by
  // default, computed on an empty body. When the browser PUTs the real file,
  // S3/SeaweedFS validates the checksum against the actual body and rejects
  // with XAmzContentChecksumMismatch. WHEN_REQUIRED disables that.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const BUCKET = bucket;
