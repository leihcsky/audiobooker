import type { Metadata } from "next";
import Link from "next/link";
import { WorkspacePreview } from "@/components/marketing/workspace-preview";
import { auth } from "@/lib/auth/auth";
import { serializeJsonLd } from "@/lib/tools/seo-page";
import { getSiteUrl } from "@/lib/tools/site";

const TITLE = "Audiobooker — Online Audiobook Production Studio";
const DESCRIPTION =
  "Create and produce audiobooks online. Import your manuscript, organize chapters, narrate with AI voices, regenerate what needs work, and export MP3 or M4B.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: getSiteUrl() },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: getSiteUrl(),
    siteName: "Audiobooker",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const STAGES = [
  {
    name: "Import",
    body: "Upload your manuscript as an EPUB, PDF, or TXT file. The text, title, and cover are pulled in when the file has them.",
  },
  {
    name: "Structure",
    body: "Chapters are detected for you. Choose which ones belong in the audiobook and leave out front matter or notes.",
  },
  {
    name: "Narrate",
    body: "Pick from more than 30 natural AI voices, set the reading speed, and preview before you commit.",
  },
  {
    name: "Produce",
    body: "Generate chapter by chapter, listen as each one finishes, and regenerate any chapter that needs another take.",
  },
  {
    name: "Export",
    body: "Download an M4B with chapter markers, cover art, and book metadata, or a ZIP of chapter MP3s.",
  },
];

const PROJECT_POINTS = [
  {
    title: "Your book stays a project",
    body: "Chapters, voice choices, and finished audio are saved together, so you can leave and pick up where you stopped.",
  },
  {
    title: "Fix one chapter, not the whole book",
    body: "Change the voice or speed for a single chapter and regenerate just that chapter. Everything else stays as it is.",
  },
  {
    title: "Metadata and cover included",
    body: "Set the title, author, narrator, publisher, copyright, and language, and add a cover. They travel with every export.",
  },
  {
    title: "Export whenever you're ready",
    body: "Export again after every change. Each M4B is rebuilt with the latest chapters, metadata, and cover.",
  },
];

const OTHER_CREATORS = [
  "Educators and course creators",
  "Newsletter writers and bloggers",
  "Independent publishers",
];

const TOOLS = [
  {
    href: "/audiobook-maker",
    title: "Audiobook Maker",
    body: "Upload an EPUB, PDF, or TXT and make an audiobook in your browser.",
  },
  {
    href: "/epub-to-audiobook",
    title: "EPUB to Audiobook",
    body: "Keep your EPUB's chapters, title, author, and cover.",
  },
  {
    href: "/pdf-to-audiobook",
    title: "PDF to Audiobook",
    body: "Narrate a text-based PDF, from textbooks to manuscripts.",
  },
  {
    href: "/ebook-to-audiobook",
    title: "Ebook to Audiobook",
    body: "Find out which ebook file to use and whether it will work.",
  },
];

const STUDIO_POINTS = [
  "Saved projects you can return to",
  "Chapter-level regeneration with any voice and speed",
  "Book metadata, narrator credit, and cover",
  "Repeat exports to M4B and MP3",
  "A larger monthly narration allowance",
];

const FAQS = [
  {
    question: "What is Audiobooker?",
    answer:
      "Audiobooker is an online studio for producing audiobooks. You import a manuscript, organize its chapters, narrate it with AI voices, rework the chapters that need it, and export a finished audiobook file.",
  },
  {
    question: "How is it different from an audiobook converter?",
    answer:
      "A converter turns a file into audio once. Audiobooker keeps your book as a project: you can come back to it, regenerate individual chapters, edit the book's metadata and cover, and export again whenever something changes.",
  },
  {
    question: "Do I need an account?",
    answer:
      "Not to try it. The free tools let you upload a book, narrate chapters, and download the result without signing up. A free account saves the project in Studio so you can keep working on it.",
  },
  {
    question: "What can I change after narration?",
    answer:
      "In Studio you can regenerate any chapter with a different voice or speed, change which chapters are included, update the title, author, narrator, publisher, copyright, and language, and replace the cover.",
  },
  {
    question: "Which files can I import and export?",
    answer:
      "Import EPUB, PDF, or TXT. Export an M4B audiobook with chapter markers, cover art, and metadata, or a ZIP with one MP3 per chapter.",
  },
  {
    question: "Can I publish the audiobook I produce?",
    answer:
      "You can use the exported files wherever you have the rights to. Only publish audiobooks of books you wrote or hold the audio rights to, and check each distributor's requirements, including its policy on AI narration.",
  },
];

function organizationJsonLd(siteUrl: string) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Audiobooker",
      url: siteUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Audiobooker",
      url: siteUrl,
      description: DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];
}

export default async function HomePage() {
  const session = await auth();
  const signedIn = Boolean(session?.user);
  const createHref = signedIn ? "/studio/projects/new" : "/signup";

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      {organizationJsonLd(getSiteUrl()).map((item) => (
        <script
          key={String(item["@type"])}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }}
        />
      ))}

      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Online audiobook production studio
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-tight tracking-tight md:text-6xl">
            Create and produce audiobooks online.
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Turn your manuscript into an audiobook project: chapters you can organize, AI
            narration you can preview and regenerate, and a finished MP3 or M4B with
            chapters, cover, and metadata.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href={createHref}
              className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create an audiobook
            </Link>
            <Link
              href="/audiobook-maker"
              className="inline-flex h-11 items-center rounded-md border border-border px-6 text-sm font-medium hover:bg-muted"
            >
              Try it free, no sign-up
            </Link>
          </div>
        </div>
        <WorkspacePreview />
      </section>

      <section className="mt-24">
        <h2 className="font-serif text-3xl tracking-tight">From manuscript to finished audiobook</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-5">
          {STAGES.map((stage, index) => (
            <li key={stage.name} className="border-t border-border pt-4">
              <span className="font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-1 font-serif text-xl">{stage.name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{stage.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-24">
        <h2 className="font-serif text-3xl tracking-tight">A project, not a one-off conversion</h2>
        <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
          Producing an audiobook takes more than one pass. Audiobooker keeps everything about
          your book in one place, so you can refine it until it sounds right.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PROJECT_POINTS.map((point) => (
            <div key={point.title} className="rounded-lg border border-border p-6">
              <h3 className="font-serif text-xl">{point.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{point.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24 grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="font-serif text-3xl tracking-tight">Built for independent authors</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            You finished the book. Now readers are asking for the audiobook, and booking a
            studio and a narrator isn&apos;t in the budget. Audiobooker lets you produce the
            audio edition yourself: keep your chapter structure, choose a voice that suits the
            story, and redo any chapter until you&apos;re happy with it.
          </p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="font-medium">Also used by</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {OTHER_CREATORS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-24">
        <h2 className="font-serif text-3xl tracking-tight">Start free, continue in Studio</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="font-serif text-xl">Free tools</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Try Audiobooker without an account. Start from the page that matches your file.
            </p>
            <ul className="mt-4 space-y-4">
              {TOOLS.map((tool) => (
                <li key={tool.href}>
                  <Link href={tool.href} className="font-medium hover:underline">
                    {tool.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">{tool.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border p-6">
            <h3 className="font-serif text-xl">Audiobooker Studio</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Save a free project, or bring a book you started in a free tool, and keep
              producing it.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {STUDIO_POINTS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true" className="text-muted-foreground">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={signedIn ? "/studio" : "/signup"}
              className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {signedIn ? "Open Studio" : "Create a free account"}
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-24">
        <h2 className="font-serif text-3xl tracking-tight">Questions about Audiobooker</h2>
        <dl className="mt-6 space-y-6">
          {FAQS.map((item) => (
            <div key={item.question}>
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-1 leading-7 text-muted-foreground">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
