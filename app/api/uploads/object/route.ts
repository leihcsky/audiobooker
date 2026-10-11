import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { fileInvalid } from "@/lib/api/errors";
import { transferSourceObject } from "@/lib/ingestion/source.service";

export async function POST(request: Request) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const form = await request.formData();
    const objectKey = String(form.get("objectKey") ?? "");
    const file = form.get("file");

    if (!objectKey || !(file instanceof File)) {
      throw fileInvalid("A file and storage key are required.");
    }

    const body = Buffer.from(await file.arrayBuffer());
    await transferSourceObject({
      actor,
      objectKey,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      body,
    });

    return success({ uploaded: true });
  });
}
