import { describe, expect, it } from "vitest";
import { clientIpFromHeaders, hashClientNetwork, networkKey } from "@/lib/tools/client-network";

function headersOf(values: Record<string, string>) {
  return new Headers(values);
}

describe("client network hashing", () => {
  it("prefers the edge-provided client IP and ignores invalid values", () => {
    expect(
      clientIpFromHeaders(
        headersOf({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1, 10.0.0.1" }),
      ),
    ).toBe("203.0.113.7");
    expect(clientIpFromHeaders(headersOf({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe(
      "198.51.100.1",
    );
    expect(clientIpFromHeaders(headersOf({ "x-real-ip": "not-an-ip" }))).toBeNull();
  });

  it("keeps full IPv4 addresses and collapses IPv6 to its /64", () => {
    expect(networkKey("203.0.113.7")).toBe("203.0.113.7");
    expect(networkKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(networkKey("2001:db8:0:1:aaaa::1")).toBe("2001:db8:0:1::/64");
    expect(networkKey("2001:0db8:0000:0001:bbbb:cccc:dddd:eeee")).toBe("2001:db8:0:1::/64");
    expect(networkKey("garbage")).toBeNull();
  });

  it("hashes with the salt and never returns the raw address", () => {
    const a = hashClientNetwork("2001:db8:0:1::1", "salt");
    const b = hashClientNetwork("2001:db8:0:1:ffff::2", "salt");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(hashClientNetwork("2001:db8:0:1::1", "other")).not.toBe(a);
    expect(hashClientNetwork(null, "salt")).toBeNull();
  });
});
