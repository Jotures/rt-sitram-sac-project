import type { AttachmentMetadata } from "../../lib/powersync/product-writes";

const DEVICE_ID_KEY = "rt-sitram.driver-device-id";

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function getOrCreateDeviceId(
  store: KeyValueStore = window.localStorage,
  generateId: () => string = () => crypto.randomUUID(),
): string {
  const existing = store.getItem(DEVICE_ID_KEY);

  if (existing !== null && existing.trim().length > 0) {
    return existing;
  }

  const created = generateId();
  store.setItem(DEVICE_ID_KEY, created);
  return created;
}

export async function persistEvidenceFile(file: File): Promise<AttachmentMetadata> {
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  if (!allowedMimeTypes.has(file.type)) {
    throw new Error("El comprobante debe ser JPG, PNG, WebP o PDF.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("El comprobante no puede superar 10 MB.");
  }

  if (navigator.storage.getDirectory === undefined) {
    throw new Error("Este dispositivo no permite guardar evidencia offline.");
  }

  const id = crypto.randomUUID();
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle("rt-sitram-evidence", { create: true });
  const handle = await directory.getFileHandle(id, { create: true });
  const writable = await handle.createWritable();
  await writable.write(file);
  await writable.close();

  return {
    localUri: `opfs://rt-sitram-evidence/${id}`,
    originalName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export async function discardEvidenceFile(localUri: string): Promise<void> {
  const prefix = "opfs://rt-sitram-evidence/";
  if (!localUri.startsWith(prefix) || navigator.storage.getDirectory === undefined) return;
  const name = localUri.slice(prefix.length);
  if (name.length === 0 || name.includes("/")) return;
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle("rt-sitram-evidence", { create: true });
  await directory.removeEntry(name).catch(() => undefined);
}
