import { createHash } from "node:crypto";
import { isIP } from "node:net";

type HeaderReader = { get(name: string): string | null };

export function clientIpFromHeaders(headers: HeaderReader): string | null {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && isIP(value)) {
      return value;
    }
  }
  return null;
}

/** IPv4 keeps the full address; IPv6 collapses to its /64 so rotating host bits does not reset limits. */
export function networkKey(ip: string): string | null {
  const mapped = ip.toLowerCase().startsWith("::ffff:") ? ip.slice(7) : ip;
  const version = isIP(mapped);
  if (version === 4) {
    return mapped;
  }
  if (version !== 6) {
    return null;
  }
  const [head, tail = ""] = mapped.toLowerCase().split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = mapped.includes("::") ? 8 - headParts.length - tailParts.length : 0;
  const groups = [...headParts, ...Array<string>(Math.max(0, missing)).fill("0"), ...tailParts];
  return `${groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

export function hashClientNetwork(ip: string | null, salt = process.env.IP_HASH_SALT ?? ""): string | null {
  const key = ip ? networkKey(ip) : null;
  if (!key) {
    return null;
  }
  return createHash("sha256").update(`${salt}${key}`).digest("hex");
}
