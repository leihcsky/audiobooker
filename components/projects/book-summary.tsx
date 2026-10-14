import type { ReactNode } from "react";
import type { BookStats } from "@/lib/projects/book-stats";
import { formatSpokenLength } from "@/lib/tts/narration-length";

type BookSummaryProps = {
  title: string;
  author: string | null;
  coverUrl: string | null;
  stats: BookStats;
  /** Studio already shows the title as the page heading. */
  showTitle?: boolean;
};

export function BookSummary({ title, author, coverUrl, stats, showTitle = true }: BookSummaryProps) {
  return (
    <div className="flex items-start gap-5">
      <BookCover title={title} coverUrl={coverUrl} />
      <div className="min-w-0 flex-1 space-y-3">
        {showTitle ? (
          <div>
            <h2 className="font-serif text-2xl leading-tight break-words">{title}</h2>
            {author ? <p className="mt-1 text-sm text-muted-foreground">by {author}</p> : null}
          </div>
        ) : null}
        <ul className="flex flex-wrap gap-2">
          <StatPill value={stats.chapters.toLocaleString("en-US")} label={stats.chapters === 1 ? "chapter" : "chapters"} />
          <StatPill value={stats.words.toLocaleString("en-US")} label="words" />
          <StatPill value={formatSpokenLength(stats.seconds)} label="of audio" />
        </ul>
      </div>
    </div>
  );
}

function BookCover({ title, coverUrl }: { title: string; coverUrl: string | null }) {
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt={`Cover of ${title}`}
        className="h-32 w-24 shrink-0 rounded-md border border-border object-cover shadow-sm"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-32 w-24 shrink-0 flex-col justify-between rounded-md border border-border bg-gradient-to-br from-muted to-muted/40 p-2.5 shadow-sm"
    >
      <span className="line-clamp-4 font-serif text-xs leading-snug break-words">{title}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">No cover</span>
    </div>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <li className="inline-flex items-baseline gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm">
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </li>
  );
}

type SelectionSummaryProps = {
  selected: BookStats;
  totalChapters: number;
  actions?: ReactNode;
};

export function SelectionSummary({ selected, totalChapters, actions }: SelectionSummaryProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Selected for the audiobook</p>
        <p className="mt-1 text-sm">
          <strong className="text-base tabular-nums">{selected.chapters}</strong> of {totalChapters} chapters
          <span className="text-muted-foreground"> · </span>
          <strong className="tabular-nums">{selected.words.toLocaleString("en-US")}</strong> words
          <span className="text-muted-foreground"> · </span>
          about <strong className="tabular-nums">{formatSpokenLength(selected.seconds)}</strong>
        </p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
