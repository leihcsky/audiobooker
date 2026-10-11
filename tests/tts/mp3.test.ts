import { describe, expect, it } from "vitest";
import { concatMp3Buffers, stripId3 } from "@/lib/tts/mp3";

function id3Prefix(): Buffer {
  const header = Buffer.alloc(10);
  header.write("ID3", 0, "ascii");
  header[3] = 3;
  header[9] = 5;
  return Buffer.concat([header, Buffer.from("xxxxx")]);
}

describe("mp3 helpers", () => {
  it("returns a single buffer unchanged", () => {
    const audio = Buffer.from("audio-one");
    expect(concatMp3Buffers([audio])).toBe(audio);
  });

  it("strips ID3 tags before concatenating chunks", () => {
    const first = Buffer.concat([id3Prefix(), Buffer.from("AAA")]);
    const second = Buffer.concat([id3Prefix(), Buffer.from("BBB")]);
    const merged = concatMp3Buffers([first, second]);
    expect(merged.equals(Buffer.from("AAABBB"))).toBe(true);
    expect(stripId3(first).equals(Buffer.from("AAA"))).toBe(true);
  });
});
