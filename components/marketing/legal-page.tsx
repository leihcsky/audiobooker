import type { ReactNode } from "react";
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "@/lib/legal";

export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="font-serif text-4xl tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {LEGAL_LAST_UPDATED}</p>
      <div className="mt-6 text-lg text-muted-foreground">{intro}</div>
      <div className="mt-10 space-y-10">{children}</div>
      <p className="mt-14 border-t border-border pt-6 text-sm text-muted-foreground">
        Questions? Email <ContactEmail />.
      </p>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 leading-relaxed">
      <h2 className="font-serif text-2xl">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function ContactEmail() {
  return (
    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline">
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}
