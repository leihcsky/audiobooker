import type { Metadata } from "next";
import { seoToolName, type SeoToolConfig } from "@/lib/tools/tool-config";
import { getSiteUrl } from "@/lib/tools/site";

const SITE_NAME = "Audiobooker";

export function seoToolMetadata(config: SeoToolConfig): Metadata {
  const canonical = `${getSiteUrl()}/${config.slug}`;
  return {
    title: config.title,
    description: config.description,
    alternates: { canonical },
    openGraph: {
      title: config.title,
      description: config.description,
      url: canonical,
      siteName: SITE_NAME,
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: config.title,
      description: config.description,
    },
  };
}

export function seoToolJsonLd(config: SeoToolConfig): Record<string, unknown>[] {
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/${config.slug}`;
  const name = seoToolName(config);
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      browserRequirements: "Requires JavaScript and a modern web browser.",
      url,
      description: config.description,
      ...(config.features?.length ? { featureList: config.features } : {}),
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        url: siteUrl,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: config.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name, item: url },
      ],
    },
  ];
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
