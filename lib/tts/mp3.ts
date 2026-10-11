export function concatMp3Buffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) {
    throw new Error("No audio chunks to concatenate.");
  }
  if (buffers.length === 1) {
    return buffers[0];
  }
  return Buffer.concat(buffers.map(stripId3));
}

export function stripId3(buffer: Buffer): Buffer {
  let start = 0;
  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "ID3") {
    const size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    start = Math.min(buffer.length, 10 + size);
  }

  let end = buffer.length;
  if (end - start >= 128 && buffer.toString("ascii", end - 128, end - 125) === "TAG") {
    end -= 128;
  }
  return buffer.subarray(start, end);
}

const MPEG_VERSIONS = [2.5, 0, 2, 1] as const;
const LAYERS = [0, 3, 2, 1] as const;
const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const SAMPLE_RATES_V1 = [44100, 48000, 32000];
const SAMPLE_RATES_V2 = [22050, 24000, 16000];
const SAMPLE_RATES_V25 = [11025, 12000, 8000];

export function estimateMp3DurationSeconds(buffer: Buffer): number | null {
  const data = stripId3(buffer);
  let offset = 0;
  let duration = 0;
  let frames = 0;

  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff || (data[offset + 1] & 0xe0) !== 0xe0) {
      offset += 1;
      continue;
    }

    const header = data.readUInt32BE(offset);
    const versionId = (header >> 19) & 0x3;
    const layerId = (header >> 17) & 0x3;
    const bitrateIndex = (header >> 12) & 0xf;
    const sampleRateIndex = (header >> 10) & 0x3;
    const padding = (header >> 9) & 0x1;
    const version = MPEG_VERSIONS[versionId];
    const layer = LAYERS[layerId];

    if (!version || !layer || sampleRateIndex === 3 || bitrateIndex === 0 || bitrateIndex === 15) {
      offset += 1;
      continue;
    }

    const sampleRate = sampleRateFor(version, sampleRateIndex);
    const bitrateKbps = bitrateFor(version, layer, bitrateIndex);
    if (!sampleRate || !bitrateKbps) {
      offset += 1;
      continue;
    }

    const samplesPerFrame = layer === 1 ? 384 : version === 1 ? 1152 : 576;
    const frameLength =
      layer === 1
        ? Math.floor(((12 * bitrateKbps * 1000) / sampleRate + padding) * 4)
        : Math.floor((samplesPerFrame / 8 * bitrateKbps * 1000) / sampleRate + padding);

    if (frameLength < 4) {
      offset += 1;
      continue;
    }

    duration += samplesPerFrame / sampleRate;
    frames += 1;
    offset += frameLength;
  }

  if (frames === 0) {
    return null;
  }
  return Math.round(duration * 1000) / 1000;
}

function sampleRateFor(version: number, index: number): number | null {
  const table = version === 1 ? SAMPLE_RATES_V1 : version === 2 ? SAMPLE_RATES_V2 : SAMPLE_RATES_V25;
  return table[index] ?? null;
}

function bitrateFor(version: number, layer: number, index: number): number | null {
  if (layer !== 3) {
    return null;
  }
  const table = version === 1 ? BITRATES_V1_L3 : BITRATES_V2_L3;
  return table[index] || null;
}

export function estimateDurationFromCharacters(characterCount: number): number {
  return Math.round((characterCount / 15) * 10) / 10;
}
