import { S3Client } from "@aws-sdk/client-s3";

export function getBucketConfig() {
  return {
    bucketName: process.env.R2_BUCKET_NAME ?? "",
    folderPrefix: process.env.R2_FOLDER_PREFIX ?? "",
    publicUrl: process.env.NEXT_PUBLIC_R2_URL ?? "",
  };
}

export function createS3Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });
}
