import { createR2Storage } from "@/lib/storage/r2";
import type { StorageProvider } from "@/lib/storage/types";

export type { StorageProvider } from "@/lib/storage/types";

let storage: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (!storage) {
    storage = createR2Storage();
  }
  return storage;
}
