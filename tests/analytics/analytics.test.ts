import { afterEach, describe, expect, it, vi } from "vitest";
import { getGaMeasurementId } from "@/components/analytics/google-analytics";

describe("getGaMeasurementId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off when no measurement ID is set", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
    expect(getGaMeasurementId()).toBeNull();
  });

  it("accepts a GA4 measurement ID", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", " G-MDH1CCCYMT ");
    expect(getGaMeasurementId()).toBe("G-MDH1CCCYMT");
  });

  it("rejects anything that is not a measurement ID", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-ABC');alert(1);//");
    expect(getGaMeasurementId()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "UA-12345-1");
    expect(getGaMeasurementId()).toBeNull();
  });
});
