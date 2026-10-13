import { z } from "zod";

export const checkoutSchema = z.object({
  item: z.enum(["creator", "short", "book", "series"], {
    error: "Choose a plan or minute pack.",
  }),
});
