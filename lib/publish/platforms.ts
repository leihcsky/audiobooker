export type PublishPlatformId = "spotify" | "google-play";

export type PlatformSource = { label: string; url: string };

export type PublishPlatform = {
  id: PublishPlatformId;
  name: string;
  uploadUrl: string;
  /** How the uploader marks AI narration on this platform. */
  disclosureStep: string;
  /** Limits on where an AI-narrated title is distributed, if any. */
  distributionNote: string | null;
  cover: {
    /** Hard minimum on each side; null when the platform only publishes a recommendation. */
    minPixels: number | null;
    recommendedPixels: number;
    squareRequired: boolean;
  };
  audio: {
    minBitrateKbps: number;
    constantBitrate: boolean;
    /** Required sample rate; null when the platform does not specify one. */
    sampleRateHz: number | null;
    maxFileMinutes: number | null;
    minTotalMinutes: number | null;
    headSilenceSeconds: [number, number] | null;
    tailSilenceSeconds: [number, number] | null;
  };
  narratorRequired: boolean;
  descriptionRequired: boolean;
  openingCreditsRequired: boolean;
  sources: PlatformSource[];
  /** ISO date the rules above were last checked against the sources. */
  lastChecked: string;
};

export const PUBLISH_PLATFORMS: Record<PublishPlatformId, PublishPlatform> = {
  spotify: {
    id: "spotify",
    name: "Spotify for Authors",
    uploadUrl: "https://authors.spotify.com",
    disclosureStep: "Select “This audiobook uses digital voice narration” when you upload.",
    distributionNote:
      "Spotify distributes digitally narrated audiobooks on Spotify only; they are not sent to its referral partners.",
    cover: { minPixels: null, recommendedPixels: 3000, squareRequired: true },
    audio: {
      minBitrateKbps: 192,
      constantBitrate: true,
      sampleRateHz: 44_100,
      maxFileMinutes: 120,
      minTotalMinutes: null,
      headSilenceSeconds: [0.5, 1],
      tailSilenceSeconds: [1, 5],
    },
    narratorRequired: true,
    descriptionRequired: true,
    openingCreditsRequired: true,
    sources: [
      {
        label: "Digital voice narration",
        url: "https://support.spotify.com/us/authors/article/digital-voice-narration/",
      },
      {
        label: "Uploading audiobooks",
        url: "https://support.spotify.com/us/authors/article/uploading-audiobooks/",
      },
      {
        label: "Metadata and asset guide (PDF)",
        url: "https://support.spotifycdn.com/pdf/SFA%20Metadata_Asset%20Guide_2024.pdf",
      },
    ],
    lastChecked: "2026-10-13",
  },
  "google-play": {
    id: "google-play",
    name: "Google Play Books",
    uploadUrl: "https://play.google.com/books/publish/",
    disclosureStep: "Add a narrator contributor and choose “Synthesized voice” as the narrator type.",
    distributionNote: null,
    cover: { minPixels: 1024, recommendedPixels: 2400, squareRequired: false },
    audio: {
      minBitrateKbps: 128,
      constantBitrate: false,
      sampleRateHz: null,
      maxFileMinutes: null,
      minTotalMinutes: 5,
      headSilenceSeconds: null,
      tailSilenceSeconds: null,
    },
    narratorRequired: true,
    descriptionRequired: false,
    openingCreditsRequired: false,
    sources: [
      {
        label: "Add a new book (narrator settings)",
        url: "https://support.google.com/books/partner/answer/9261664",
      },
      {
        label: "Book file guidelines",
        url: "https://support.google.com/books/partner/answer/3424254",
      },
    ],
    lastChecked: "2026-10-13",
  },
};

export const PUBLISH_PLATFORM_IDS = Object.keys(PUBLISH_PLATFORMS) as PublishPlatformId[];

export function isPublishPlatformId(value: string | undefined): value is PublishPlatformId {
  return value !== undefined && Object.prototype.hasOwnProperty.call(PUBLISH_PLATFORMS, value);
}
