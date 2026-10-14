import type { MetadataRoute } from "next";
import { SEO_TOOLS } from "@/lib/tools/tool-config";
import { LEGAL_LINKS } from "@/lib/legal";
import { getSiteUrl } from "@/lib/tools/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  return [
    {
      url: site,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...SEO_TOOLS.map((tool) => ({
      url: `${site}/${tool.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    {
      url: `${site}/pricing`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${site}/publish-audiobook`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...LEGAL_LINKS.map((link) => ({
      url: `${site}${link.href}`,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
