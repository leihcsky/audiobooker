import { createSeoToolPage } from "@/lib/tools/render-seo-page";

const page = createSeoToolPage("ebook-to-audiobook");

export const generateMetadata = page.generateMetadata;
export default page.Page;
