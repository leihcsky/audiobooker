import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  CreateDownloadUrlInput,
  CreateDownloadUrlResult,
  CreateUploadUrlInput,
  CreateUploadUrlResult,
  HeadObjectResult,
  StorageProvider,
} from "@/lib/storage/types";
import { attachmentDisposition } from "@/lib/export/filenames";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function getR2Config() {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const endpoint =
    process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`;

  return {
    bucket: requireEnv("R2_BUCKET"),
    client: new S3Client({
      region: "auto",
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    }),
  };
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  const maybeTransform = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof maybeTransform.transformToByteArray === "function") {
    return Buffer.from(await maybeTransform.transformToByteArray());
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createR2Storage(): StorageProvider {
  return {
    async createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
      const { client, bucket } = getR2Config();
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
        ContentType: input.contentType,
      });
      const uploadUrl = await getSignedUrl(client, command, {
        expiresIn: input.expiresInSeconds,
      });

      return {
        uploadUrl,
        objectKey: input.objectKey,
        expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
      };
    },

    async createDownloadUrl(input: CreateDownloadUrlInput): Promise<CreateDownloadUrlResult> {
      const { client, bucket } = getR2Config();
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
        ...(input.downloadFilename
          ? { ResponseContentDisposition: attachmentDisposition(input.downloadFilename) }
          : {}),
      });
      const downloadUrl = await getSignedUrl(client, command, {
        expiresIn: input.expiresInSeconds,
      });

      return {
        downloadUrl,
        objectKey: input.objectKey,
        expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
      };
    },

    async putObject(input) {
      const { client, bucket } = getR2Config();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: input.objectKey,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    },

    async headObject(objectKey: string): Promise<HeadObjectResult> {
      const { client, bucket } = getR2Config();
      try {
        const result = await client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: objectKey,
          }),
        );

        return {
          exists: true,
          sizeBytes: result.ContentLength,
          contentType: result.ContentType,
        };
      } catch (error) {
        const maybe = error as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (
          maybe.name === "NotFound" ||
          maybe.name === "NoSuchKey" ||
          maybe.$metadata?.httpStatusCode === 404
        ) {
          return { exists: false };
        }
        throw error;
      }
    },

    async getObject(objectKey: string): Promise<Buffer> {
      const { client, bucket } = getR2Config();
      const result = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );
      return streamToBuffer(result.Body);
    },

    async deleteObject(objectKey: string): Promise<void> {
      const { client, bucket } = getR2Config();
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );
    },
  };
}
