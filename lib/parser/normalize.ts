export function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr|section|article)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");

  return normalizeText(decodeEntities(withoutScripts));
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

export function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export function extractHeadingTitle(html: string): string | null {
  const match = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (!match) {
    return null;
  }
  const title = htmlToText(match[1]);
  return title.length > 0 ? title.slice(0, 500) : null;
}

export function splitByHeadings(html: string): Array<{ title: string; content: string }> {
  const parts = html.split(/(?=<h[1-3]\b)/i);
  const chapters: Array<{ title: string; content: string }> = [];

  for (const part of parts) {
    const text = htmlToText(part);
    if (!text) {
      continue;
    }
    chapters.push({
      title: extractHeadingTitle(part) ?? `Chapter ${chapters.length + 1}`,
      content: text,
    });
  }

  return chapters;
}
