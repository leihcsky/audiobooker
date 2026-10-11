import { formatProjectStatus } from "@/lib/utils";
import { cn } from "@/lib/utils";

type ProjectStatusBadgeProps = {
  status: string;
};

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "DRAFT" && "bg-secondary text-secondary-foreground",
        status === "PENDING" && "bg-secondary text-secondary-foreground",
        status === "READY" && "bg-primary/10 text-primary",
        (status === "PROCESSING" || status === "GENERATING") && "bg-accent text-accent-foreground",
        status === "FAILED" && "bg-destructive/10 text-destructive",
        status === "ARCHIVED" && "bg-muted text-muted-foreground",
      )}
    >
      {formatProjectStatus(status)}
    </span>
  );
}
