import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { LEGAL_CONTACT_EMAIL, LEGAL_LINKS } from "@/lib/legal";
import { hasSamples } from "@/lib/samples/samples";

type FooterLink = { href: string; label: string };

const COMPANY_HREFS = new Set<string>(["/about", "/contact"]);

const TOOL_LINKS: FooterLink[] = [
  { href: "/audiobook-maker", label: "Audiobook Maker" },
  { href: "/epub-to-audiobook", label: "EPUB to Audiobook" },
  { href: "/pdf-to-audiobook", label: "PDF to Audiobook" },
  { href: "/ebook-to-audiobook", label: "Ebook to Audiobook" },
];

function resourceLinks(): FooterLink[] {
  return [
    { href: "/publish-audiobook", label: "Publishing Guide" },
    ...(hasSamples() ? [{ href: "/samples", label: "Samples" }] : []),
    { href: "/pricing", label: "Pricing" },
  ];
}

export function SiteFooter() {
  const companyLinks = LEGAL_LINKS.filter((link) => COMPANY_HREFS.has(link.href));
  const policyLinks = LEGAL_LINKS.filter((link) => !COMPANY_HREFS.has(link.href));

  return (
    <footer className="border-t border-border text-sm">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-12 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="sm:col-span-2 md:col-span-1">
          <Link href="/" className="inline-flex items-center gap-2 font-medium text-foreground">
            <LogoMark className="size-6 shrink-0" />
            Audiobooker
          </Link>
          <p className="mt-3 max-w-xs leading-6 text-muted-foreground">
            Your online audiobook production studio, from manuscript to finished audiobook.
          </p>
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="mt-4 inline-block text-muted-foreground hover:text-foreground"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
        </div>
        <FooterColumn title="Tools" links={TOOL_LINKS} />
        <FooterColumn title="Resources" links={resourceLinks()} />
        <FooterColumn title="Company" links={companyLinks} />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Audiobooker</p>
          <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2">
            {policyLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: readonly FooterLink[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="font-medium text-foreground">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-muted-foreground hover:text-foreground">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
