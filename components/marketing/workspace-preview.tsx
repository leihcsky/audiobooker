type PreviewChapter = {
  number: string;
  title: string;
  status: "ready" | "generating" | "queued";
  detail: string;
};

const CHAPTERS: PreviewChapter[] = [
  { number: "01", title: "The Crossing", status: "ready", detail: "24 min" },
  { number: "02", title: "Lanterns", status: "ready", detail: "31 min" },
  { number: "03", title: "Salt and Iron", status: "generating", detail: "64%" },
  { number: "04", title: "Low Tide", status: "queued", detail: "Queued" },
  { number: "05", title: "The Keeper's Log", status: "queued", detail: "Queued" },
];

const STATUS_DOT: Record<PreviewChapter["status"], string> = {
  ready: "bg-primary",
  generating: "bg-primary/50 animate-pulse",
  queued: "bg-border",
};

/** Illustrative, static picture of a Studio project; not live data. */
export function WorkspacePreview() {
  return (
    <figure
      role="img"
      aria-label="Example Audiobooker project: a book with a chapter list showing ready, generating, and queued chapters, a selected voice, and M4B and MP3 export."
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <div aria-hidden="true">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-14 shrink-0 items-end rounded-md bg-gradient-to-br from-primary/80 to-primary/30 p-1.5">
            <span className="font-serif text-[9px] leading-tight text-primary-foreground">
              The Silent Harbor
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-serif text-lg font-semibold leading-tight">The Silent Harbor</p>
            <p className="text-sm">by M. Ellison</p>
            <p className="mt-1 text-xs text-muted-foreground">12 chapters · 68,400 words · 7 h 36 min</p>
          </div>
        </div>

        <ol className="mt-5 divide-y divide-border border-y border-border text-sm">
          {CHAPTERS.map((chapter) => (
            <li key={chapter.number} className="flex items-center gap-3 py-2">
              <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[chapter.status]}`} />
              <span className="font-mono text-xs text-muted-foreground">{chapter.number}</span>
              <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
              {chapter.status === "generating" ? (
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full w-2/3 rounded-full bg-primary" />
                </span>
              ) : null}
              <span className="w-14 text-right text-xs text-muted-foreground">{chapter.detail}</span>
              {chapter.number === "02" ? (
                <span className="rounded border border-border px-1.5 py-0.5 text-[11px]">Regenerate</span>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="rounded-md bg-muted px-2 py-1">Voice: Ava · Female · 1.0×</span>
          <span className="flex gap-2">
            <span className="rounded-md border border-border px-2 py-1">Export M4B</span>
            <span className="rounded-md border border-border px-2 py-1">MP3 ZIP</span>
          </span>
        </div>
      </div>
    </figure>
  );
}
