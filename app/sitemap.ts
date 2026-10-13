import type { MetadataRoute } from "next";
import { SEO_TOOLS } from "@/lib/tools/tool-config";
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
      url: `${site}/publish-audiobook`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
