import JSZip from "jszip";

type EpubChapter = {
  id: string;
  title: string;
  html: string;
};

type EpubTocEntry = {
  title: string;
  href: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createTinyPng(width = 400, height = 600): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.write("\u0089PNG\r\n\u001a\n", 0, "binary");
  buffer.write("IHDR", 12);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

export async function createEpubFixture(input: {
  title?: string;
  author?: string;
  language?: string;
  chapters: EpubChapter[];
  toc?: EpubTocEntry[];
  coverPng?: Buffer;
  extraFiles?: Record<string, string>;
}): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const coverItem = input.coverPng
    ? `<item id="cover-image" href="cover.png" media-type="image/png" properties="cover-image"/>`
    : "";
  const navItem = input.toc
    ? `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`
    : "";
  const manifest = input.chapters
    .map((chapter) => `<item id="${chapter.id}" href="${chapter.id}.xhtml" media-type="application/xhtml+xml"/>`)
    .join("\n");
  const spine = input.chapters.map((chapter) => `<itemref idref="${chapter.id}"/>`).join("\n");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(input.title ?? "Untitled")}</dc:title>
    <dc:creator>${escapeXml(input.author ?? "Unknown")}</dc:creator>
    <dc:language>${input.language ?? "en"}</dc:language>
  </metadata>
  <manifest>
    ${coverItem}
    ${navItem}
    ${manifest}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`,
  );

  if (input.coverPng) {
    zip.file("OEBPS/cover.png", input.coverPng);
  }

  if (input.toc) {
    const items = input.toc
      .map((entry) => `<li><a href="${escapeXml(entry.href)}">${escapeXml(entry.title)}</a></li>`)
      .join("\n");
    zip.file(
      "OEBPS/nav.xhtml",
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="toc">
      <ol>
        ${items}
      </ol>
    </nav>
  </body>
</html>`,
    );
  }

  for (const chapter of input.chapters) {
    zip.file(
      `OEBPS/${chapter.id}.xhtml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>${escapeXml(chapter.title)}</h1>
    ${chapter.html}
  </body>
</html>`,
    );
  }

  for (const [name, contents] of Object.entries(input.extraFiles ?? {})) {
    zip.file(name, contents);
  }

  return zip.generateAsync({ type: "nodebuffer" });
}
