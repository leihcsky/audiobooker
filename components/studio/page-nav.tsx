import Link from "next/link";
import { ArrowLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

type Crumb = { label: string; href?: string };

type StudioPageNavProps = {
  back: { href: string; label: string };
  /** Path from Projects down to the current page; the last item is the current page. */
  trail: Crumb[];
};

export function StudioPageNav({ back, trail }: StudioPageNavProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link
        href={back.href}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
      >
        <ArrowLeftIcon />
        <span className="max-w-[18rem] truncate">{back.label}</span>
      </Link>
      <nav aria-label="Breadcrumb" className="min-w-0 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {trail.map((crumb, index) => {
            const last = index === trail.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
                {index > 0 ? <ChevronRightIcon className="size-3.5 shrink-0" /> : null}
                {crumb.href && !last ? (
                  <Link href={crumb.href} className="truncate hover:text-foreground hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate text-foreground" aria-current={last ? "page" : undefined}>
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
