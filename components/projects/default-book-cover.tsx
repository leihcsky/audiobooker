import { cn } from "@/lib/utils";

type DefaultBookCoverProps = {
  title: string;
  author?: string | null;
  /** Portrait for project summary; square for the export cover slot. */
  variant?: "portrait" | "square";
  className?: string;
};

/**
 * Brand placeholder when a project has no uploaded cover.
 * Keeps the layout stable without a bare “No cover” box.
 */
export function DefaultBookCover({
  title,
  author = null,
  variant = "portrait",
  className,
}: DefaultBookCoverProps) {
  const square = variant === "square";
  return (
    <div
      role="img"
      aria-label={`Default cover for ${title}`}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border border-[#c4b39a]/70 shadow-sm",
        square ? "h-40 w-40" : "h-32 w-24",
        className,
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(155deg, #3f2a1d 0%, #6b3a24 42%, #8a5a3a 72%, #c4a574 100%)",
        }}
      />
      {/* Soft paper wash */}
      <div
        className="absolute inset-0 opacity-35"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(246,241,232,0.35), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(35,28,22,0.35), transparent 50%)",
        }}
      />
      {/* Spine edge */}
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#f6f1e8]/35 via-[#f6f1e8]/10 to-transparent" />
      {/* Sound bars motif */}
      <div
        className={cn(
          "absolute flex items-end gap-0.5 opacity-40",
          square ? "right-3 bottom-3 h-8" : "right-2 bottom-2 h-6",
        )}
        aria-hidden="true"
      >
        {[40, 70, 55, 90, 45, 75, 35].map((height, index) => (
          <span
            key={index}
            className="w-0.5 rounded-full bg-[#f6f1e8]"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <div
        className={cn(
          "relative flex h-full flex-col justify-between text-[#f6f1e8]",
          square ? "p-3.5" : "p-2.5",
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "font-serif leading-snug break-words",
              square ? "line-clamp-4 text-sm" : "line-clamp-4 text-[11px]",
            )}
          >
            {title}
          </p>
          {author ? (
            <p
              className={cn(
                "mt-1 truncate text-[#f6f1e8]/75",
                square ? "text-xs" : "text-[9px]",
              )}
            >
              {author}
            </p>
          ) : null}
        </div>
        <p className={cn("font-medium tracking-[0.14em] uppercase text-[#f6f1e8]/55", square ? "text-[10px]" : "text-[8px]")}>
          Audiobooker
        </p>
      </div>
    </div>
  );
}
