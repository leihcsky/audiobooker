import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import type { ChapterNeighbor } from "@/lib/chapters/chapter.service";
import { cn } from "@/lib/utils";

type ChapterPagerProps = {
  projectId: string;
  previous: ChapterNeighbor | null;
  next: ChapterNeighbor | null;
};

type PagerLinkProps = {
  href: string;
  chapter: ChapterNeighbor;
  direction: "previous" | "next";
};

function PagerLink({ href, chapter, direction }: PagerLinkProps) {
  const isNext = direction === "next";
  const Icon = isNext ? ChevronRightIcon : ChevronLeftIcon;
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card px-6 py-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40",
        isNext && "flex-row-reverse text-right",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {isNext ? "Next chapter" : "Previous chapter"}
        </span>
        <span className="mt-1 flex min-w-0 items-baseline gap-2 text-base font-medium">
          <span className={cn("shrink-0 font-mono text-sm text-muted-foreground", isNext && "order-last")}>
            {String(chapter.orderIndex).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
        </span>
      </span>
    </Link>
  );
}

export function ChapterPager({ projectId, previous, next }: ChapterPagerProps) {
  if (!previous && !next) {
    return null;
  }
  return (
    <nav aria-label="Chapter navigation" className="grid gap-4 sm:grid-cols-2">
      {previous ? (
        <PagerLink
          href={`/studio/projects/${projectId}/chapters/${previous.id}`}
          chapter={previous}
          direction="previous"
        />
      ) : (
        <span className="hidden sm:block" />
      )}
      {next ? (
        <PagerLink
          href={`/studio/projects/${projectId}/chapters/${next.id}`}
          chapter={next}
          direction="next"
        />
      ) : null}
    </nav>
  );
}
