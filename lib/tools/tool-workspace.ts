const STORAGE_KEY = "audiobooker:tool-project";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type ToolProjectBinding = {
  projectId: string;
  slug: string;
};

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readBinding(storage: StorageLike | null): ToolProjectBinding | null {
  const raw = storage?.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      typeof (value as ToolProjectBinding).projectId === "string" &&
      typeof (value as ToolProjectBinding).slug === "string"
    ) {
      return value as ToolProjectBinding;
    }
  } catch {
    // Treat malformed values as unbound.
  }
  return null;
}

/** Whether the session's project was created on this tool page. */
export function isProjectBoundToTool(
  projectId: string,
  slug: string,
  storage: StorageLike | null = browserStorage(),
): boolean {
  const binding = readBinding(storage);
  return binding?.projectId === projectId && binding.slug === slug;
}

export function bindProjectToTool(
  projectId: string,
  slug: string,
  storage: StorageLike | null = browserStorage(),
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ projectId, slug }));
  } catch {
    // Storage can be unavailable (private mode, quota); the page just won't restore.
  }
}

export function clearToolProjectBinding(storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
