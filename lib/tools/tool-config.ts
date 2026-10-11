export type ToolFormat = "EPUB" | "PDF" | "TXT";

export type FaqItem = {
  question: string;
  answer: string;
};

export type SeoSection = {
  heading: string;
  paragraphs?: string[];
  table?: { columns: string[]; rows: string[][] };
  points?: { term: string; text: string }[];
  /** Rendered after the table and points. */
  note?: string;
};

export type RelatedTool = {
  href: string;
  label: string;
  description?: string;
};

export type SeoToolConfig = {
  slug: string;
  title: string;
  description: string;
  primaryKeyword: string;
  /** Short line above the H1; defaults to the primary keyword. */
  eyebrow?: string;
  h1: string;
  intro: string;
  supportedFormats: ToolFormat[];
  howToTitle: string;
  howToSteps: string[];
  /** Page-specific content rendered between the how-to and the FAQ. */
  sections?: SeoSection[];
  /** Visible capabilities, reused as the structured-data feature list. */
  features?: string[];
  faq: FaqItem[];
  related: RelatedTool[];
};

const CLUSTER: RelatedTool[] = [
  {
    href: "/audiobook-maker",
    label: "Audiobook Maker",
    description: "The general starting point for EPUB, PDF, and TXT.",
  },
  {
    href: "/epub-to-audiobook",
    label: "EPUB to Audiobook",
    description: "Keep the book's own table of contents and cover.",
  },
  {
    href: "/pdf-to-audiobook",
    label: "PDF to Audiobook",
    description: "Narrate a text-based PDF after its text is extracted.",
  },
  {
    href: "/ebook-to-audiobook",
    label: "Ebook to Audiobook",
    description: "Compare EPUB, PDF, and TXT before you choose a starting point.",
  },
];

export function seoToolName(config: Pick<SeoToolConfig, "slug" | "h1">): string {
  return CLUSTER.find((item) => item.href === `/${config.slug}`)?.label ?? config.h1;
}

export const STANDARD_VOICE_LANGUAGES = [
  "English",
  "Chinese",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Japanese",
  "Korean",
] as const;

export const SEO_TOOLS: SeoToolConfig[] = [
  {
    slug: "audiobook-maker",
    title: "Audiobook Maker — Create Audiobooks from EPUB, PDF & TXT",
    description:
      "Free online audiobook maker. Upload an EPUB, PDF, or TXT, choose a natural AI voice, and generate your audiobook by chapter. Download MP3 or M4B.",
    primaryKeyword: "audiobook maker",
    eyebrow: "Free online audiobook maker",
    h1: "Audiobook Maker: Turn Your Book into an Audiobook",
    intro:
      "Upload an EPUB, PDF, or TXT file and this audiobook maker finds the chapters, narrates them with natural AI voices, and packages the result as chapter MP3s or a single M4B audiobook. Start free, no account needed.",
    supportedFormats: ["EPUB", "PDF", "TXT"],
    howToTitle: "How to make an audiobook online",
    howToSteps: [
      "Upload your book as an EPUB, PDF, or TXT file. Audiobooker extracts the text, builds the chapter list, and keeps the cover when the file has one.",
      "Choose the chapters to narrate. Leave out front matter, notes, or anything you don't want read aloud.",
      "Pick a narration voice and speed, then play a short preview before you commit.",
      "Click Generate audiobook. Chapters are narrated in order and each one can be played as soon as it's ready. Keep the tab open while it runs.",
      "Listen in the browser, then download a ZIP of chapter MP3s or one M4B audiobook with chapter markers and cover art.",
    ],
    sections: [
      {
        heading: "What this audiobook maker does",
        points: [
          {
            term: "Finds your chapters",
            text: "EPUB chapters come from the book's table of contents. PDF and TXT chapters come from the headings in the text, so the audiobook follows the structure of the book.",
          },
          {
            term: "Narrates with natural AI voices",
            text: `Choose from more than 30 neural voices in ${STANDARD_VOICE_LANGUAGES.slice(0, -1).join(", ")}, and ${STANDARD_VOICE_LANGUAGES.at(-1)}, and set the reading speed.`,
          },
          {
            term: "Generates the whole book in one run",
            text: "One click narrates every selected chapter in order, with progress shown next to each chapter.",
          },
          {
            term: "Lets you listen before you download",
            text: "Play any finished chapter, or listen to the book from start to finish in the built-in player.",
          },
          {
            term: "Exports a real audiobook file",
            text: "Download an M4B with chapter markers and square cover art sized for Apple Books, or a ZIP of MP3 files named by chapter.",
          },
        ],
      },
      {
        heading: "A finished audiobook, not just narration",
        paragraphs: [
          "A text-to-speech generator on its own stops at an audio clip. An audiobook people can actually listen to also needs chapters in the right order, chapter markers to jump between them, cover art, and a file format that audiobook apps understand.",
          "Audiobooker generates the narration chapter by chapter and assembles the rest for you. The M4B opens in Apple Books and other audiobook players with a chapter list and cover, and the MP3 ZIP keeps every chapter as a separate, clearly named file, with no audio editor needed.",
        ],
      },
      {
        heading: "Who uses an audiobook maker",
        points: [
          {
            term: "Independent authors",
            text: "Hear a manuscript read aloud while editing, or produce a listenable edition of a finished book.",
          },
          {
            term: "Readers with an ebook",
            text: "Turn an EPUB or PDF you own into audio for a commute, a walk, or a break from the screen.",
          },
          {
            term: "Teachers and course creators",
            text: "Convert lesson notes, handouts, or long reading lists into audio students can listen to.",
          },
          {
            term: "Language learners",
            text: "Listen to texts in the language you're studying, read by a native-sounding voice at a speed you choose.",
          },
        ],
      },
      {
        heading: "Free to start, Studio when the book is bigger",
        paragraphs: [
          "A free session lets you upload a book, narrate chapters within the free session allowance, listen online, and export both MP3 and M4B. Save the project to a free account to keep it, finish longer books with a larger monthly allowance, and regenerate individual chapters in Studio.",
          "Uploaded books and generated audio are stored privately and are only reachable through short-lived links. Temporary projects are deleted after a few days unless you save them. Only upload books you have the right to convert.",
        ],
      },
    ],
    features: [
      "EPUB, PDF, and TXT upload",
      "Automatic chapter detection",
      "More than 30 natural AI voices",
      "Adjustable narration speed and voice preview",
      "One-click generation of every selected chapter",
      "In-browser audiobook player",
      "M4B export with chapter markers and cover art",
      "MP3 ZIP export",
    ],
    faq: [
      {
        question: "Is this audiobook maker free?",
        answer:
          "Yes. You can make an audiobook without paying or creating an account. Free sessions include a narration allowance, and a free account adds a larger monthly allowance in Studio.",
      },
      {
        question: "Do I need an account to create an audiobook?",
        answer:
          "No. Upload, generate, listen, and download without signing up. Create an account when you want to keep the project or continue a long book later.",
      },
      {
        question: "Which files can I turn into an audiobook?",
        answer:
          "EPUB, PDF, and TXT. EPUB gives the cleanest chapters because it has a table of contents. PDFs need selectable text; scanned, image-only PDFs can't be read.",
      },
      {
        question: "What voices and languages are available?",
        answer: `More than 30 natural AI voices in ${STANDARD_VOICE_LANGUAGES.join(", ")}. Pick a voice that matches the language of your book and preview it first.`,
      },
      {
        question: "How long does it take to generate an audiobook?",
        answer:
          "It depends on the length of the book. Chapters are narrated one after another and progress is shown for each one. Keep the page open until the last chapter is ready; finished chapters are kept if you stop.",
      },
      {
        question: "Can I download an M4B audiobook with chapters?",
        answer:
          "Yes. The M4B includes a chapter marker for every chapter and the book cover, so it opens as an audiobook in Apple Books and other audiobook players. You can also download chapter MP3s as a ZIP.",
      },
      {
        question: "Can I listen before downloading?",
        answer:
          "Yes. Each finished chapter can be played on the page, and the built-in player reads the book chapter after chapter.",
      },
      {
        question: "Is the narration AI-generated?",
        answer:
          "Yes. Chapters are read by neural text-to-speech voices, so the narration sounds natural without recording anything yourself. Listen to a preview first to choose the voice that suits your book.",
      },
    ],
    related: CLUSTER.filter((item) => item.href !== "/audiobook-maker"),
  },
  {
    slug: "epub-to-audiobook",
    title: "EPUB to Audiobook Converter — MP3 & M4B with Chapters",
    description:
      "Convert EPUB to audiobook online. Chapters follow your book's table of contents, with the cover, title, and author kept. Pick an AI voice, get MP3 or M4B.",
    primaryKeyword: "epub to audiobook",
    eyebrow: "EPUB to audiobook converter",
    h1: "EPUB to Audiobook: Convert Your EPUB to MP3 or M4B",
    intro:
      "Upload a DRM-free EPUB and get an audiobook that follows the book itself: chapters from its table of contents, title and author from its metadata, and its cover art. Narrate it with natural AI voices, then download chapter MP3s or a single M4B.",
    supportedFormats: ["EPUB"],
    howToTitle: "How to convert EPUB to audiobook",
    howToSteps: [
      "Upload a DRM-free .epub file. The chapter list is built from the book's table of contents, and the title, author, language, and cover are read from the EPUB.",
      "Check the chapter list. Table-of-contents pages are skipped automatically; untick anything else you don't want read aloud, such as copyright pages or endnotes.",
      "Choose a narration voice. A voice in the book's language is selected for you, and you can preview others before you start.",
      "Generate the audiobook. Chapters are narrated in reading order, and each one can be played as soon as it's ready.",
      "Download an M4B whose chapter markers match the EPUB's table of contents, or a ZIP of MP3 files, one per chapter.",
    ],
    sections: [
      {
        heading: "Why EPUB converts to audio so cleanly",
        paragraphs: [
          "An EPUB already knows its own structure. The table of contents says where every chapter starts, and the metadata carries the title, author, language, and cover. Audiobooker uses that structure instead of guessing, so chapters begin where the author intended instead of wherever a page happened to break.",
          "PDFs are laid out for print, with page numbers, running headers, and hyphenated line breaks mixed into the text. If you have both an EPUB and a PDF of the same book, start with the EPUB.",
        ],
      },
      {
        heading: "What carries over from your EPUB",
        points: [
          {
            term: "Chapters",
            text: "Both EPUB 3 navigation documents and EPUB 2 NCX tables of contents are read, including books that keep several chapters in one file.",
          },
          {
            term: "Title and author",
            text: "Written into the audiobook's tags, so your player shows the right book and author.",
          },
          {
            term: "Language",
            text: "Used to pick a narration voice in the same language as the book.",
          },
          {
            term: "Cover art",
            text: "Turned into a square audiobook cover and embedded in the M4B.",
          },
        ],
      },
      {
        heading: "Where to find DRM-free EPUB files",
        points: [
          {
            term: "Your own manuscript",
            text: "Book formatting tools such as Vellum, Atticus, and Calibre can export an EPUB of your book.",
          },
          {
            term: "Public-domain classics",
            text: "Project Gutenberg and Standard Ebooks offer free, DRM-free EPUB editions of classic books.",
          },
          {
            term: "DRM-free publishers",
            text: "Some publishers and authors sell EPUBs without DRM, and their store pages usually say so.",
          },
        ],
        note: "Books locked to a reading app with DRM can't be opened here, so their text can't be narrated.",
      },
    ],
    features: [
      "EPUB 2 and EPUB 3 upload",
      "Chapters from the EPUB table of contents",
      "Title, author, language, and cover read from EPUB metadata",
      "More than 30 natural AI voices",
      "In-browser audiobook player",
      "EPUB to M4B with chapter markers and cover art",
      "EPUB to MP3, one file per chapter",
    ],
    faq: [
      {
        question: "Can I convert an EPUB to an audiobook for free?",
        answer:
          "Yes. Upload an EPUB, narrate it within the free session's allowance, and download the result without creating an account. Save the project to a free account to finish longer books in Studio.",
      },
      {
        question: "Can I convert EPUB to M4B?",
        answer:
          "Yes. The M4B has a chapter marker for every chapter in your EPUB's table of contents, plus the cover, title, and author, so it opens as a proper audiobook in Apple Books and other audiobook players.",
      },
      {
        question: "Can I convert EPUB to MP3?",
        answer:
          "Yes. The MP3 export is a ZIP with one file per chapter, numbered in reading order and named after the chapter title.",
      },
      {
        question: "Why are some chapters missing or combined?",
        answer:
          "Chapters follow the EPUB's table of contents. If the table of contents lists only parts, or leaves sections out, the chapter list will match it. Short entries with no readable text are skipped.",
      },
      {
        question: "Does it work with DRM-protected EPUBs?",
        answer:
          "No. An EPUB protected with DRM can only be opened in the reading app it was sold for, so its text can't be narrated. Use a DRM-free EPUB, such as your own manuscript or a public-domain edition.",
      },
      {
        question: "What happens to images, footnotes, and tables?",
        answer:
          "Images aren't narrated. Footnotes and tables are read as text where they appear in the book. If the endnotes are a separate chapter, untick it to leave them out.",
      },
    ],
    related: CLUSTER.filter((item) => item.href !== "/epub-to-audiobook"),
  },
  {
    slug: "pdf-to-audiobook",
    title: "PDF to Audiobook Converter — Turn PDFs into MP3 or M4B",
    description:
      "Convert PDF to audiobook online. Upload a text-based PDF, get chapters from its headings, pick a natural AI voice, and download MP3 or M4B audio.",
    primaryKeyword: "pdf to audiobook",
    eyebrow: "PDF to audiobook converter",
    h1: "PDF to Audiobook: Turn a PDF into Narrated Audio",
    intro:
      "Upload a PDF ebook, textbook, report, or manuscript. Audiobooker extracts the text, starts a new chapter at headings such as “Chapter 1”, and narrates it with natural AI voices. Listen in your browser, or download chapter MP3s or a single M4B.",
    supportedFormats: ["PDF"],
    howToTitle: "How to convert a PDF to an audiobook",
    howToSteps: [
      "Upload a PDF with selectable text. If you can highlight words in your PDF reader, Audiobooker can read them.",
      "Review the chapter list. Lines such as “Chapter 3” or “3. Methods” start a new chapter; a PDF without headings like these becomes one chapter that you can still narrate in full.",
      "Untick chapters you don't want read aloud, such as the table of contents, index, or references.",
      "Choose a voice in the PDF's language, play a preview, and generate the audiobook chapter by chapter.",
      "Listen online, then download a ZIP of chapter MP3s or one M4B named after your PDF file.",
    ],
    sections: [
      {
        heading: "Which PDFs convert well",
        points: [
          {
            term: "Text-based PDFs",
            text: "Ebooks, reports, and documents exported from Word, Google Docs, or a publishing tool contain real text and convert well.",
          },
          {
            term: "Scanned PDFs",
            text: "Pages scanned or photographed as images have no text to read. Run them through OCR (text recognition) first, or upload an EPUB or TXT edition instead.",
          },
          {
            term: "Password-protected PDFs",
            text: "Locked files can't be opened. Save an unlocked copy in your PDF reader before uploading.",
          },
          {
            term: "Complex layouts",
            text: "Multi-column pages, sidebars, and tables are read in the order the text is stored in the file, which may differ from how the page looks.",
          },
        ],
      },
      {
        heading: "What to expect from PDF narration",
        paragraphs: [
          "A PDF is designed for print, so the narration comes from its text layer, not its layout. Images, fonts, and page design are left out, and there's no built-in chapter list or cover to carry over. The audiobook takes its title from the PDF's file name, so rename the file before uploading if you want a cleaner title.",
          "If you also have the same book as an EPUB, use that instead: its table of contents and metadata give you cleaner chapters, the author's name, and cover art.",
        ],
      },
      {
        heading: "What people turn from PDF into audio",
        points: [
          {
            term: "Textbooks and course readers",
            text: "Go over assigned chapters on a commute, at the gym, or away from the screen.",
          },
          {
            term: "Reports and research papers",
            text: "Listen to long documents instead of reading them at a desk.",
          },
          {
            term: "Manuscripts and drafts",
            text: "Hear your writing read aloud to catch clumsy sentences and missing words.",
          },
          {
            term: "PDF ebooks",
            text: "Turn a DRM-free PDF ebook you own into an audiobook you can play in any audiobook app.",
          },
        ],
      },
    ],
    features: [
      "Text-based PDF upload",
      "Chapter detection from headings in the text",
      "More than 30 natural AI voices",
      "Voice preview before narration",
      "In-browser audiobook player",
      "PDF to MP3, one file per chapter",
      "PDF to M4B with chapter markers",
    ],
    faq: [
      {
        question: "Can I convert a PDF to an audiobook for free?",
        answer:
          "Yes. Upload a PDF, narrate it within the free session's allowance, and download the audio without creating an account. Save the project to a free account to finish long documents in Studio.",
      },
      {
        question: "Can I convert a scanned PDF?",
        answer:
          "Not directly. A scanned PDF is a set of page images with no text layer. Run it through OCR first and upload the result, or use an EPUB or TXT edition of the same text.",
      },
      {
        question: "How are chapters found in a PDF?",
        answer:
          "PDFs rarely include a usable chapter list, so chapters come from headings in the text. Lines such as “Chapter 4” or “4. Results” start a new chapter. Without headings like these, the whole PDF becomes one chapter.",
      },
      {
        question: "Will page numbers and headers be read aloud?",
        answer:
          "They can be. Page numbers and running headers are part of a PDF's text, so some may end up in the narration. An EPUB or TXT version of the same text avoids this.",
      },
      {
        question: "Can I convert PDF to MP3 or M4B?",
        answer:
          "Both. The MP3 export is a ZIP with one file per chapter. The M4B is a single audiobook file with chapter markers that opens in Apple Books and other audiobook players.",
      },
      {
        question: "Is there a file size limit?",
        answer:
          "Yes. The limit for a free session is shown above the upload button, and a free account accepts larger PDFs. Image-heavy PDFs are often large but contain little text to narrate.",
      },
      {
        question: "What languages can a PDF be narrated in?",
        answer: `${STANDARD_VOICE_LANGUAGES.join(", ")}. PDFs don't record their language reliably, so choose a voice that matches the text before you generate.`,
      },
    ],
    related: CLUSTER.filter((item) => item.href !== "/pdf-to-audiobook"),
  },
  {
    slug: "ebook-to-audiobook",
    title: "Ebook to Audiobook — Listen to EPUB, PDF & TXT Ebooks",
    description:
      "Convert ebook to audiobook online from EPUB, PDF, or TXT. Find out which format works best, pick a natural AI voice, and download MP3 or M4B.",
    primaryKeyword: "ebook to audiobook",
    eyebrow: "For EPUB, PDF, and TXT ebooks",
    h1: "Ebook to Audiobook: Listen to Your EPUB, PDF, or TXT Ebook",
    intro:
      "Have an ebook you'd rather listen to? Upload it as an EPUB, PDF, or TXT file and Audiobooker narrates it chapter by chapter with natural AI voices. Not sure which file to use, or whether a store-bought ebook will work? The format guide below explains.",
    supportedFormats: ["EPUB", "PDF", "TXT"],
    howToTitle: "How to turn an ebook into an audiobook",
    howToSteps: [
      "Pick the best file you have. If the same book exists in several formats, EPUB gives the cleanest result, then PDF, then TXT.",
      "Upload it, check the chapter list, and choose a voice in the book's language.",
      "Generate the narration, listen in your browser, and download chapter MP3s or an M4B audiobook.",
    ],
    sections: [
      {
        heading: "Which ebook format should you upload?",
        paragraphs: [
          "All three formats become the same kind of audiobook. What differs is how much of the book's structure comes with the text.",
        ],
        table: {
          columns: ["Format", "Chapters", "Title, author, and cover", "Best for"],
          rows: [
            ["EPUB", "From the ebook's table of contents", "Read from the file", "Most ebooks and self-published books"],
            ["PDF", "From headings such as “Chapter 1”", "Title from the file name, no cover", "Textbooks, reports, and PDF-only ebooks"],
            ["TXT", "From headings such as “Chapter One”", "Title from the file name, no cover", "Plain-text classics and drafts"],
          ],
        },
        note: "Save TXT files as UTF-8 so accented letters and non-Latin scripts come through correctly. PDFs need selectable text; scanned pages can't be read.",
      },
      {
        heading: "Ebooks from Kindle, Apple Books, Kobo, and other stores",
        paragraphs: [
          "Many ebooks sold in these stores are protected with DRM, which locks the file to the store's own reading app. Audiobooker can't open DRM-protected files, so those books can't be narrated here. Check whether the book already has an audiobook edition, or use the reading app's built-in read-aloud feature if it has one.",
          "DRM-free ebooks work well: books from publishers and authors who sell without DRM, public-domain editions, and manuscripts you've written yourself.",
        ],
      },
      {
        heading: "Have a MOBI, AZW3, or DOCX file?",
        paragraphs: [
          "These formats can't be uploaded directly. If the file is DRM-free, the free Calibre ebook manager can convert MOBI and AZW3 to EPUB, and Word can save a DOCX as a PDF. Upload the converted file instead.",
        ],
      },
      {
        heading: "How long will your audiobook be?",
        paragraphs: [
          "Narration runs at roughly 150 words per minute at normal speed. After you upload, Audiobooker shows the word count and estimated listening time for the whole book and for every chapter.",
        ],
        table: {
          columns: ["Book", "Typical length", "Listening time"],
          rows: [
            ["Short story", "7,500 words", "About 50 minutes"],
            ["Novella", "20,000 words", "About 2 hours"],
            ["Novel", "70,000 words", "About 8 hours"],
            ["Long novel", "120,000 words", "About 13 hours"],
          ],
        },
      },
    ],
    features: [
      "EPUB, PDF, and TXT ebook upload",
      "Chapter detection for every supported format",
      "Word count and listening time estimate per chapter",
      "More than 30 natural AI voices",
      "In-browser audiobook player",
      "MP3 and M4B audiobook downloads",
    ],
    faq: [
      {
        question: "Can I turn a Kindle book into an audiobook?",
        answer:
          "Not if it was bought from the Kindle store and is protected with DRM, because the file can only be opened in Kindle apps. If you have a DRM-free copy of the book, such as your own manuscript, convert it to EPUB and upload that.",
      },
      {
        question: "Is it free to convert an ebook to an audiobook?",
        answer:
          "Yes, to get started. A free session includes a narration allowance and lets you listen and download without an account. A free account adds a larger monthly allowance for long books.",
      },
      {
        question: "What if my ebook is longer than the free allowance?",
        answer:
          "Generate the chapters that fit today; finished chapters stay with the project. Save it to a free account to narrate the rest in Studio.",
      },
      {
        question: "Will the audiobook sound natural?",
        answer:
          "The neural voices handle punctuation and pacing well, but they are still synthetic. Unusual names, invented words, and dialogue between many characters sound flatter than with a human narrator. Preview a few voices and adjust the speed to suit the book.",
      },
      {
        question: "Can I listen on my phone?",
        answer:
          "Yes. Open the M4B in Apple Books on iPhone or in an audiobook player app on Android, or copy the MP3s to any music player. You can also listen straight from this page in a mobile browser.",
      },
      {
        question: "Can I share or sell the audiobook I make?",
        answer:
          "Only if you hold the rights. An audiobook made from someone else's ebook is for your own listening; publishing or sharing it usually needs permission from the rights holder, because audio rights are separate from ebook rights.",
      },
    ],
    related: CLUSTER.filter((item) => item.href !== "/ebook-to-audiobook"),
  },
];

export function getSeoTool(slug: string): SeoToolConfig | undefined {
  return SEO_TOOLS.find((tool) => tool.slug === slug);
}

export function acceptAttribute(formats: ToolFormat[]): string {
  return formats
    .map((format) => {
      if (format === "EPUB") {
        return ".epub,application/epub+zip";
      }
      if (format === "PDF") {
        return ".pdf,application/pdf";
      }
      return ".txt,text/plain";
    })
    .join(",");
}
