import type { ParsedChapter } from "@/lib/parser/types";
import { htmlToText } from "@/lib/parser/normalize";

export type TocEntry = {
  title: string;
  href: string;
  fragment: string | null;
};

export function parseHref(href: string): { href: string; fragment: string | null } {
  const [path, fragment] = href.split("#");
  return {
    href: (path ?? "").replace(/\\/g, "/"),
    fragment: fragment?.trim() || null,
  };
}

export function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function nodeText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  const record = value as Record<string, unknown>;
  if (typeof record["#text"] === "string") {
    return record["#text"].trim();
  }
  return Object.values(record)
    .map((item) => nodeText(item))
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function collectNavEntriesFromHtml(html: string): TocEntry[] {
  const tocNav = html.match(
    /<nav\b[^>]*(?:epub:)?type=["'][^"']*\btoc\b[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i,
  );
  const chunk = tocNav?.[1] ?? html.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i)?.[1] ?? html;
  const entries: TocEntry[] = [];
  const anchor = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = anchor.exec(chunk);
  while (match) {
    const title = htmlToText(match[2] ?? "");
    const href = (match[1] ?? "").trim();
    if (href && title) {
      entries.push({ title: title.slice(0, 500), ...parseHref(href) });
    }
    match = anchor.exec(chunk);
  }
  return entries;
}

export function collectNavEntries(node: unknown): TocEntry[] {
  const entries: TocEntry[] = [];

  function walk(value: unknown) {
    for (const item of asArray(value as Record<string, unknown> | undefined)) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as Record<string, unknown>;
      const anchor = record.a;
      if (anchor) {
        const hrefRaw =
          typeof (anchor as { "@_href"?: string })["@_href"] === "string"
            ? (anchor as { "@_href": string })["@_href"]
            : "";
        const title = nodeText(anchor) || nodeText(record);
        if (hrefRaw && title) {
          const parsed = parseHref(hrefRaw);
          entries.push({ title: title.slice(0, 500), ...parsed });
        }
      }
      if (record.ol) {
        walk((record.ol as { li?: unknown }).li ?? record.ol);
      }
      if (record.li) {
        walk(record.li);
      }
    }
  }

  walk(node);
  return entries;
}

export function collectNcxEntries(navMap: unknown): TocEntry[] {
  const entries: TocEntry[] = [];

  function walk(value: unknown) {
    for (const point of asArray(value as Record<string, unknown> | undefined)) {
      if (!point || typeof point !== "object") {
        continue;
      }
      const record = point as Record<string, unknown>;
      const label = nodeText(record.navLabel);
      const content = record.content as { "@_src"?: string } | undefined;
      const src = content?.["@_src"];
      if (label && src) {
        const parsed = parseHref(src);
        entries.push({ title: label.slice(0, 500), ...parsed });
      }
      if (record.navPoint) {
        walk(record.navPoint);
      }
    }
  }

  walk(navMap);
  return entries;
}

export function isSkippableTocTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase().replace(/[™®]/g, "");
  if (/^(contents|table of contents|toc)$/i.test(normalized)) {
    return true;
  }
  if (/project gutenberg/.test(normalized) && /license/.test(normalized)) {
    return true;
  }
  if (/^the full project gutenberg/.test(normalized)) {
    return true;
  }
  return false;
}

export function sliceHtmlByFragment(
  html: string,
  startId: string | null,
  nextId: string | null,
): string {
  const start = startId ? indexOfId(html, startId) : 0;
  if (start < 0) {
    return html;
  }
  const end = nextId ? indexOfId(html, nextId, start + 1) : -1;
  if (end < 0) {
    return html.slice(start);
  }
  return html.slice(start, end);
}

function indexOfId(html: string, id: string, from = 0): number {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = new RegExp(`<[a-zA-Z][^>]*\\sid=["']${escaped}["']`, "i");
  const slice = html.slice(from);
  const match = slice.search(tag);
  return match < 0 ? -1 : from + match;
}

export function chaptersFromToc(
  entries: TocEntry[],
  files: Map<string, string>,
  resolveFile: (href: string) => string | undefined,
): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || isSkippableTocTitle(entry.title)) {
      continue;
    }

    const fileKey = resolveFile(entry.href);
    const html = fileKey ? files.get(fileKey) : undefined;
    if (!html) {
      continue;
    }

    const nextInFile = entries.slice(index + 1).find((candidate) => {
      const nextKey = resolveFile(candidate.href);
      return nextKey === fileKey && Boolean(candidate.fragment);
    });

    const slice = sliceHtmlByFragment(html, entry.fragment, nextInFile?.fragment ?? null);
    const content = htmlToText(slice);
    if (content.length < 8) {
      continue;
    }

    chapters.push({
      title: entry.title,
      content,
      order: chapters.length + 1,
    });
  }

  return chapters;
}
