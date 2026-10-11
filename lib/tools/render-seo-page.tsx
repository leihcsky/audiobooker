import { auth } from "@/lib/auth/auth";
import { SeoToolPage } from "@/components/seo-tools/seo-tool-page";
import { getSeoTool } from "@/lib/tools/tool-config";
import { seoToolMetadata } from "@/lib/tools/seo-page";

export function createSeoToolPage(slug: string) {
  const config = getSeoTool(slug);
  if (!config) {
    throw new Error(`Unknown SEO tool: ${slug}`);
  }

  return {
    generateMetadata() {
      return seoToolMetadata(config);
    },
    async Page() {
      const session = await auth();
      return <SeoToolPage config={config} signedIn={Boolean(session?.user)} />;
    },
  };
}
