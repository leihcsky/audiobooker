import { createSeoToolPage } from "@/lib/tools/render-seo-page";

const page = createSeoToolPage("audiobook-maker");

export const generateMetadata = page.generateMetadata;
export default page.Page;
