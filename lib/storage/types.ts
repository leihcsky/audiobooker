export type CreateUploadUrlInput = {
  objectKey: string;
  contentType: string;
  expiresInSeconds: number;
};

export type CreateUploadUrlResult = {
  uploadUrl: string;
  objectKey: string;
  expiresAt: Date;
};

export type HeadObjectResult = {
  exists: boolean;
  sizeBytes?: number;
  contentType?: string;
};

export type PutObjectInput = {
  objectKey: string;
  body: Buffer;
  contentType: string;
};

export type CreateDownloadUrlInput = {
  objectKey: string;
  expiresInSeconds: number;
  /** When set, the URL forces a download with this filename instead of inline playback. */
  downloadFilename?: string;
};

export type CreateDownloadUrlResult = {
  downloadUrl: string;
  objectKey: string;
  expiresAt: Date;
};

export interface StorageProvider {
  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult>;
  createDownloadUrl(input: CreateDownloadUrlInput): Promise<CreateDownloadUrlResult>;
  putObject(input: PutObjectInput): Promise<void>;
  headObject(objectKey: string): Promise<HeadObjectResult>;
  getObject(objectKey: string): Promise<Buffer>;
  deleteObject(objectKey: string): Promise<void>;
}
