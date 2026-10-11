import { fileInvalid, fileTooLarge, fileTypeNotSupported } from "@/lib/api/errors";
import { FILE_LIMITS } from "@/lib/config/limits";

export type CoverImageKind = "jpg" | "png" | "webp";

export type ImageDimensions = {
  width: number;
  height: number;
};

export type DetectedCoverImage = {
  kind: CoverImageKind;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  dimensions: ImageDimensions;
};

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) {
      break;
    }

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) {
      break;
    }

    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  return null;
}

function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24 || buffer.toString("ascii", 12, 16) !== "IHDR") {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30) {
    return null;
  }

  const fourcc = buffer.toString("ascii", 12, 16);
  if (fourcc === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (fourcc === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  if (fourcc === "VP8X") {
    return {
      width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
      height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16),
    };
  }

  return null;
}

export function validateCoverImage(buffer: Buffer): DetectedCoverImage {
  if (buffer.length === 0) {
    throw fileInvalid("The cover image is empty.");
  }
  if (buffer.length > FILE_LIMITS.MAX_COVER_SIZE) {
    throw fileTooLarge();
  }

  const detected = detectCoverImage(buffer);
  if (!detected) {
    throw fileTypeNotSupported();
  }

  const { width, height } = detected.dimensions;
  if (width < FILE_LIMITS.MIN_COVER_DIMENSION || height < FILE_LIMITS.MIN_COVER_DIMENSION) {
    throw fileInvalid(
      `Cover image must be at least ${FILE_LIMITS.MIN_COVER_DIMENSION}x${FILE_LIMITS.MIN_COVER_DIMENSION} pixels.`,
    );
  }
  if (width > FILE_LIMITS.MAX_COVER_DIMENSION || height > FILE_LIMITS.MAX_COVER_DIMENSION) {
    throw fileInvalid(
      `Cover image must be at most ${FILE_LIMITS.MAX_COVER_DIMENSION}x${FILE_LIMITS.MAX_COVER_DIMENSION} pixels.`,
    );
  }

  return detected;
}

export function detectCoverImage(buffer: Buffer): DetectedCoverImage | null {
  if (isJpeg(buffer)) {
    const dimensions = readJpegDimensions(buffer);
    if (!dimensions) {
      return null;
    }
    return { kind: "jpg", contentType: "image/jpeg", dimensions };
  }

  if (isPng(buffer)) {
    const dimensions = readPngDimensions(buffer);
    if (!dimensions) {
      return null;
    }
    return { kind: "png", contentType: "image/png", dimensions };
  }

  if (isWebp(buffer)) {
    const dimensions = readWebpDimensions(buffer);
    if (!dimensions) {
      return null;
    }
    return { kind: "webp", contentType: "image/webp", dimensions };
  }

  return null;
}
