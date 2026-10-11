import { describe, expect, it } from "vitest";
import {
  collectNavEntriesFromHtml,
  isSkippableTocTitle,
  sliceHtmlByFragment,
} from "@/lib/parser/epub-toc";

describe("epub toc helpers", () => {
  it("skips contents and Gutenberg license labels", () => {
    expect(isSkippableTocTitle("Contents")).toBe(true);
    expect(isSkippableTocTitle("Table of Contents")).toBe(true);
    expect(isSkippableTocTitle("The Full Project Gutenberg License")).toBe(true);
    expect(isSkippableTocTitle("CHAPTER I. Down the Rabbit-Hole")).toBe(false);
  });

  it("reads toc anchors from a navigation document", () => {
    const html = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="landmarks"><ol><li><a href="cover.xhtml">Cover</a></li></ol></nav>
    <nav epub:type="toc">
      <ol>
        <li><a href="title.xhtml">Alice's Adventures in Wonderland</a></li>
        <li><a href="contents.xhtml">Contents</a></li>
        <li><a href="c1.xhtml#ch1">CHAPTER I. Down the Rabbit-Hole</a></li>
      </ol>
    </nav>
  </body>
</html>`;

    expect(collectNavEntriesFromHtml(html).map((entry) => entry.title)).toEqual([
      "Alice's Adventures in Wonderland",
      "Contents",
      "CHAPTER I. Down the Rabbit-Hole",
    ]);
  });

  it("slices a shared xhtml file by fragment ids", () => {
    const html = `<div id="one"><p>First</p></div><div id="two"><p>Second</p></div>`;
    expect(sliceHtmlByFragment(html, "one", "two")).toContain("First");
    expect(sliceHtmlByFragment(html, "one", "two")).not.toContain("Second");
    expect(sliceHtmlByFragment(html, "two", null)).toContain("Second");
  });
});
