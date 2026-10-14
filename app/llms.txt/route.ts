import { buildLlmsTxt } from "@/lib/tools/llms-txt";
import { getSiteUrl } from "@/lib/tools/site";

export function GET() {
  return new Response(buildLlmsTxt(getSiteUrl()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
