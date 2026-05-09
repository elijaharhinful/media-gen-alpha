import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";
import { cacheGet, cacheSet, TTL } from "./cache";

const s3 = createS3Client();

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic = false,
) {
  const { bucketName, folderPrefix } = getBucketConfig();
  const prefix = isPublic
    ? `${folderPrefix}public/uploads`
    : `${folderPrefix}uploads`;
  const cloud_storage_path = `${prefix}/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentType: contentType,
    ContentDisposition: isPublic ? "attachment" : undefined,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return { uploadUrl, cloud_storage_path };
}

export async function getFileUrl(
  cloud_storage_path: string,
  isPublic: boolean,
): Promise<string> {
  const { bucketName, publicUrl } = getBucketConfig();

  // Public CDN URLs are permanent — return directly, no cache needed
  if (isPublic && publicUrl) {
    return `${publicUrl}/${cloud_storage_path}`;
  }

  // Check cache for private presigned URLs
  const cacheKey = `presigned:${cloud_storage_path}`;
  const cached = await cacheGet<string>(cacheKey);
  if (cached) return cached;

  // Generate a new presigned URL and cache it
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ResponseContentDisposition: "attachment",
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
  await cacheSet(cacheKey, url, TTL.PRESIGNED_URL);
  return url;
}

export async function deleteFile(cloud_storage_path: string) {
  const { bucketName } = getBucketConfig();
  await s3.send(
    new DeleteObjectCommand({ Bucket: bucketName, Key: cloud_storage_path }),
  );
}
