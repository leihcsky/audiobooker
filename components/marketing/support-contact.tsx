import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export function SupportContact({ className }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className ?? ""}`}>
      Need help? Email{" "}
      <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline hover:text-foreground">
        {LEGAL_CONTACT_EMAIL}
      </a>
    </p>
  );
}
