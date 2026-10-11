import { createSeoToolPage } from "@/lib/tools/render-seo-page";

const page = createSeoToolPage("pdf-to-audiobook");

export const generateMetadata = page.generateMetadata;
export default page.Page;
