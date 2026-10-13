// Checks whether this machine can synthesize speech with Edge TTS (standard voices).
// Run it on every server that will generate audio. Usage:
//   npm run tts:edge-check
//   npm run tts:edge-check -- en-GB-SoniaNeural
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const VOICE = process.argv[2] ?? "en-US-AvaNeural";
const TIMEOUT_MS = 20_000;
// Must match the endpoint override in lib/tts/providers/edge.ts.
const SYNTH_ENDPOINT = "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1";
const SEC_MS_GEC_VERSION = "1-143.0.3650.75";

MsEdgeTTS.getSynthUrl = async () => {
  const token = MsEdgeTTS.TRUSTED_CLIENT_TOKEN;
  const secMsGec = await MsEdgeTTS.generateSecMsGec(token);
  return `${SYNTH_ENDPOINT}?Ocp-Apim-Subscription-Key=${token}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${MsEdgeTTS.generateUUID()}`;
};

async function synthesize() {
  const client = new MsEdgeTTS();
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("timed out")), TIMEOUT_MS);
    });
    const run = async () => {
      await client.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = client.toStream("Audiobooker voice check.");
      return new Promise((resolve, reject) => {
        let bytes = 0;
        audioStream.on("data", (chunk) => {
          bytes += chunk.length;
        });
        audioStream.once("end", () => resolve(bytes));
        audioStream.once("error", reject);
      });
    };
    return await Promise.race([run(), timeout]);
  } finally {
    clearTimeout(timer);
    client.close();
  }
}

async function clockSkewSeconds() {
  const response = await fetch("https://api.msedgeservices.com/", { method: "HEAD" });
  const serverDate = response.headers.get("date");
  return serverDate ? Math.round((Date.now() - Date.parse(serverDate)) / 1000) : null;
}

async function exitNetwork() {
  const response = await fetch("https://ipinfo.io/json", { signal: AbortSignal.timeout(5_000) });
  const info = await response.json();
  return [info.ip, info.city, info.country, info.org].filter(Boolean).join(" · ");
}

async function main() {
  const started = Date.now();
  try {
    const bytes = await synthesize();
    if (!bytes) {
      throw new Error("no audio received");
    }
    console.log(`OK  ${VOICE}  ${bytes} bytes in ${Date.now() - started} ms`);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL  ${VOICE}  ${message}`);

    const skew = await clockSkewSeconds().catch(() => null);
    const network = await exitNetwork().catch(() => "unknown");
    console.error(`clock skew vs Microsoft: ${skew ?? "unknown"} s`);
    console.error(`exit network: ${network}`);

    if (skew !== null && Math.abs(skew) > 240) {
      console.error("Hint: the system clock is off by minutes; sync it (NTP) and retry.");
    } else if (message.includes("403")) {
      console.error(
        "Hint: Microsoft rejected the handshake. Either it changed the Edge TTS protocol again " +
          "(check github.com/rany2/edge-tts/issues) or this exit IP is blocked; try another network.",
      );
    } else if (message.includes("timed out")) {
      console.error("Hint: api.msedgeservices.com is unreachable or very slow from this network.");
    }
    process.exitCode = 1;
  }
}

void main();
