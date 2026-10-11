import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { FILE_LIMITS } from "@/lib/config/limits";
import { AppError } from "@/lib/api/errors";
import { htmlToText } from "@/lib/parser/normalize";
import {
  asArray,
  chaptersFromToc,
  collectNavEntries,
  collectNavEntriesFromHtml,
  collectNcxEntries,
  type TocEntry,
} from "@/lib/parser/epub-toc";
import type { DocumentParser, ParseInput, ParsedChapter, ParsedCover, ParsedDocument } from "@/lib/parser/types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});

function resolveHref(basePath: string, href: string): string {
  const cleaned = href.split("#")[0].replace(/\\/g, "/");
  const baseDir = basePath.includes("/") ? basePath.slice(0, basePath.lastIndexOf("/") + 1) : "";
  const joined = `${baseDir}${cleaned}`.replace(/\/+/g, "/");
  const segments: string[] = [];

  for (const part of joined.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      if (segments.length === 0) {
        throw new AppError("FILE_INVALID", "The EPUB contains an unsafe path.", 400);
      }
      segments.pop();
      continue;
    }
    segments.push(part);
  }

  return segments.join("/");
}

function assertSafeZipPath(name: string) {
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.includes("..") || /^[a-z]:/i.test(normalized)) {
    throw new AppError("FILE_INVALID", "The EPUB contains an unsafe path.", 400);
  }
}

async function loadSafeZip(buffer: Buffer): Promise<JSZip> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);
  if (names.length > FILE_LIMITS.MAX_EPUB_FILES) {
    throw new AppError("PARSE_FAILED", "The EPUB contains too many files.", 422);
  }

  let extracted = 0;
  for (const name of names) {
    assertSafeZipPath(name);
    const entry = zip.files[name];
    if (entry.dir) {
      continue;
    }
    const data = await entry.async("uint8array");
    extracted += data.byteLength;
    if (data.byteLength > FILE_LIMITS.MAX_EPUB_ENTRY_SIZE) {
      throw new AppError("PARSE_FAILED", "An EPUB entry exceeds the size limit.", 422);
    }
    if (extracted > FILE_LIMITS.MAX_EXTRACTED_EPUB_SIZE) {
      throw new AppError("PARSE_FAILED", "The EPUB extracted size exceeds the limit.", 422);
    }
  }

  return zip;
}

function firstText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (value && typeof value === "object" && "#text" in value) {
    const text = (value as { "#text"?: unknown })["#text"];
    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }
  }
  return undefined;
}

function bestHeadingTitle(html: string, fallback: string): string {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const title = htmlToText(h1[1]);
    if (title) {
      return title.slice(0, 500);
    }
  }
  const h2 = html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
  if (h2) {
    const title = htmlToText(h2[1]);
    if (title) {
      return title.slice(0, 500);
    }
  }
  return fallback;
}

function isLicenseText(title: string, content: string): boolean {
  const haystack = `${title}\n${content.slice(0, 400)}`.toLowerCase();
  return haystack.includes("project gutenberg") && haystack.includes("license");
}

async function extractCover(
  zip: JSZip,
  opfPath: string,
  manifestById: Map<string, { href: string; mediaType?: string; properties?: string }>,
  metadata: Record<string, unknown>,
): Promise<ParsedCover | undefined> {
  let coverItem: { href: string; mediaType?: string } | undefined;
  for (const item of manifestById.values()) {
    if (item.properties?.includes("cover-image")) {
      coverItem = item;
      break;
    }
  }
  if (!coverItem) {
    const metas = asArray(metadata.meta).filter(
      (item): item is Record<string, unknown> => Boolean(item && typeof item === "object"),
    );
    const coverMeta = metas.find((item) => item["@_name"] === "cover");
    const coverId = coverMeta?.["@_content"];
    if (typeof coverId === "string") {
      coverItem = manifestById.get(coverId);
    }
  }
  if (!coverItem) {
    return undefined;
  }

  const objectPath = resolveHref(opfPath, coverItem.href);
  const file = zip.file(objectPath);
  if (!file) {
    return undefined;
  }
  const buffer = Buffer.from(await file.async("uint8array"));
  if (buffer.length < 24) {
    return undefined;
  }
  return {
    buffer,
    mediaType: coverItem.mediaType ?? "image/jpeg",
  };
}

function chaptersFromSpine(
  spineItems: Array<{ "@_idref"?: string }>,
  manifestById: Map<string, { href: string; mediaType?: string; properties?: string }>,
  files: Map<string, string>,
  opfPath: string,
): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];

  for (const itemref of spineItems) {
    const idref = itemref?.["@_idref"];
    if (typeof idref !== "string") {
      continue;
    }
    const item = manifestById.get(idref);
    if (!item) {
      continue;
    }
    if (item.properties?.includes("nav") || item.mediaType === "application/x-dtbncx+xml") {
      continue;
    }
    if (item.properties?.includes("svg") && idref.toLowerCase().includes("cover")) {
      continue;
    }

    const href = resolveHref(opfPath, item.href);
    const html = files.get(href);
    if (!html) {
      continue;
    }

    const text = htmlToText(html);
    if (text.length < 40 || isLicenseText(idref, text)) {
      continue;
    }

    chapters.push({
      title: bestHeadingTitle(html, `Chapter ${chapters.length + 1}`),
      content: text,
      order: chapters.length + 1,
    });
  }

  return chapters;
}

export const epubParser: DocumentParser = {
  supports(format: string) {
    return format === "EPUB" || format === "application/epub+zip" || format === "epub";
  },

  async parse(input: ParseInput): Promise<ParsedDocument> {
    if (input.buffer.length < 4 || input.buffer.subarray(0, 2).toString() !== "PK") {
      throw new AppError("FILE_INVALID", "The file is not a valid EPUB archive.", 400);
    }

    const zip = await loadSafeZip(input.buffer);
    const containerEntry = zip.file("META-INF/container.xml");
    if (!containerEntry) {
      throw new AppError("FILE_INVALID", "The EPUB is missing container.xml.", 400);
    }

    const container = xmlParser.parse(await containerEntry.async("string"));
    const rootfile = asArray(container?.container?.rootfiles?.rootfile)[0];
    const opfPath = rootfile?.["@_full-path"];
    if (typeof opfPath !== "string" || !opfPath) {
      throw new AppError("FILE_INVALID", "The EPUB package document could not be located.", 400);
    }
    assertSafeZipPath(opfPath);

    const opfEntry = zip.file(opfPath);
    if (!opfEntry) {
      throw new AppError("FILE_INVALID", "The EPUB package document is missing.", 400);
    }

    const opf = xmlParser.parse(await opfEntry.async("string"));
    const pkg = opf.package ?? opf;
    const metadata = pkg.metadata ?? {};
    const manifestItems = asArray(pkg.manifest?.item);
    const spineItems = asArray(pkg.spine?.itemref);

    const manifestById = new Map<string, { href: string; mediaType?: string; properties?: string }>();
    for (const item of manifestItems) {
      const id = item?.["@_id"];
      const href = item?.["@_href"];
      if (typeof id === "string" && typeof href === "string") {
        manifestById.set(id, {
          href,
          mediaType: item["@_media-type"],
          properties: item["@_properties"],
        });
      }
    }

    const htmlFiles = new Map<string, string>();
    for (const item of manifestById.values()) {
      if (!item.mediaType?.includes("xhtml") && !item.mediaType?.includes("html")) {
        continue;
      }
      const path = resolveHref(opfPath, item.href);
      const file = zip.file(path);
      if (!file) {
        continue;
      }
      htmlFiles.set(path, await file.async("string"));
    }

    const locateHtml = (href: string, tocBasePath: string) => {
      const cleaned = href.split("#")[0];
      for (const base of [tocBasePath, opfPath]) {
        try {
          const resolved = resolveHref(base, cleaned);
          if (htmlFiles.has(resolved)) {
            return resolved;
          }
        } catch {
          // Unsafe or unresolvable path; try the next base.
        }
      }
      const filename = cleaned.split("/").filter(Boolean).pop();
      if (!filename) {
        return undefined;
      }
      return [...htmlFiles.keys()].find((name) => name === filename || name.endsWith(`/${filename}`));
    };

    let tocEntries: TocEntry[] = [];
    let tocBasePath = opfPath;
    const navItem = [...manifestById.values()].find((item) => item.properties?.includes("nav"));
    if (navItem) {
      const navPath = resolveHref(opfPath, navItem.href);
      const navHtml = htmlFiles.get(navPath);
      if (navHtml) {
        tocEntries = collectNavEntriesFromHtml(navHtml);
        if (tocEntries.length < 2) {
          const navDoc = xmlParser.parse(navHtml);
          const navs = asArray(navDoc?.html?.body?.nav);
          const tocNav =
            navs.find((nav) => {
              const type = String(nav?.["@_type"] ?? nav?.["@_epub:type"] ?? "");
              return type.split(/\s+/).includes("toc");
            }) ?? navs[0];
          tocEntries = collectNavEntries(tocNav?.ol?.li ?? tocNav);
        }
        tocBasePath = navPath;
      }
    }
    if (tocEntries.length < 2) {
      const ncxItem = [...manifestById.values()].find(
        (item) => item.mediaType === "application/x-dtbncx+xml",
      );
      if (ncxItem) {
        const ncxPath = resolveHref(opfPath, ncxItem.href);
        const ncxFile = zip.file(ncxPath);
        if (ncxFile) {
          const ncx = xmlParser.parse(await ncxFile.async("string"));
          tocEntries = collectNcxEntries(ncx?.ncx?.navMap?.navPoint ?? ncx?.ncx?.navMap);
          tocBasePath = ncxPath;
        }
      }
    }

    let chapters: ParsedChapter[] = [];
    if (tocEntries.length >= 2) {
      chapters = chaptersFromToc(tocEntries, htmlFiles, (href) => locateHtml(href, tocBasePath));
    }
    if (chapters.length === 0) {
      chapters = chaptersFromSpine(spineItems, manifestById, htmlFiles, opfPath);
    }

    if (chapters.length === 0) {
      throw new AppError("NO_CONTENT_EXTRACTED", "No readable chapter text was found.", 422);
    }

    const cover = await extractCover(zip, opfPath, manifestById, metadata);

    return {
      metadata: {
        title: firstText(metadata["dc:title"] ?? metadata.title),
        author: firstText(metadata["dc:creator"] ?? metadata.creator),
        language: firstText(metadata["dc:language"] ?? metadata.language),
      },
      chapters,
      cover,
    };
  },
};
