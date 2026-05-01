/*
Keep attachment storage on the app host so active tasks can serve original
files directly, while done tasks collapse them into one ZIP without changing
the task data model or the production deployment shape.
*/
import archiver from "archiver";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import unzipper from "unzipper";

import { getConfig } from "../config.js";

export const maxTaskAttachmentBytes = 10 * 1024 * 1024;

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "attachment";
}

function isWithinRoot(root: string, target: string) {
  const relativePath = relative(root, target);
  return relativePath !== ".." && !relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`);
}

export function isPreviewableMimeType(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("text/");
}

export function taskAttachmentStorageKey(taskId: string, attachmentId: string, filename: string) {
  return join("tasks", taskId, "active", `${attachmentId}-${sanitizeFilename(filename)}`);
}

export function taskArchiveStorageKey(taskId: string) {
  return join("tasks", taskId, "archive", "attachments.zip");
}

export function resolveAttachmentPath(storageKey: string) {
  return resolve(getConfig().ATTACHMENTS_DIR, storageKey);
}

async function ensureDirectoryForFile(storageKey: string) {
  await mkdir(dirname(resolveAttachmentPath(storageKey)), { recursive: true });
}

export async function ensureAttachmentsRoot() {
  await mkdir(getConfig().ATTACHMENTS_DIR, { recursive: true });
}

export async function writeAttachmentFile(storageKey: string, buffer: Buffer) {
  await ensureDirectoryForFile(storageKey);
  await writeFile(resolveAttachmentPath(storageKey), buffer);
}

export async function deleteStorageKey(storageKey: string) {
  await rm(resolveAttachmentPath(storageKey), { force: true });
}

export async function deleteTaskStorage(taskId: string) {
  await rm(resolveAttachmentPath(join("tasks", taskId)), { recursive: true, force: true });
}

export async function readAttachmentFile(storageKey: string) {
  return readFile(resolveAttachmentPath(storageKey));
}

export async function fileExists(storageKey: string) {
  try {
    await stat(resolveAttachmentPath(storageKey));
    return true;
  } catch {
    return false;
  }
}

export async function archiveTaskAttachments(taskId: string, storageKeys: string[]) {
  const archiveKey = taskArchiveStorageKey(taskId);
  const archivePath = resolveAttachmentPath(archiveKey);
  await ensureDirectoryForFile(archiveKey);

  const taskRoot = resolveAttachmentPath(join("tasks", taskId));
  const output = createWriteStream(archivePath);
  const zip = archiver("zip", { zlib: { level: 9 } });

  const completion = new Promise<void>((resolvePromise, rejectPromise) => {
    output.on("close", () => resolvePromise());
    output.on("error", rejectPromise);
    zip.on("error", rejectPromise);
  });

  zip.pipe(output);

  for (const storageKey of storageKeys) {
    const absolutePath = resolveAttachmentPath(storageKey);
    const relativePath = normalize(relative(taskRoot, absolutePath));

    if (!isWithinRoot(taskRoot, absolutePath) || relativePath.startsWith("..")) {
      throw new Error("Attachment path escaped the task storage root.");
    }

    zip.file(absolutePath, { name: relativePath });
  }

  await zip.finalize();
  await completion;

  const archiveStats = await stat(archivePath);
  return {
    storageKey: archiveKey,
    sizeBytes: archiveStats.size,
    generatedAt: new Date(),
  };
}

export async function restoreTaskArchive(taskId: string, archiveKey: string) {
  const archivePath = resolveAttachmentPath(archiveKey);
  const taskRoot = resolveAttachmentPath(join("tasks", taskId));
  await mkdir(taskRoot, { recursive: true });

  await pipeline(
    createReadStream(archivePath),
    unzipper.Extract({ path: taskRoot }),
  );
}

export async function removeActiveAttachmentFiles(storageKeys: string[]) {
  await Promise.all(storageKeys.map((storageKey) => unlink(resolveAttachmentPath(storageKey)).catch(() => undefined)));
}

export function buildAttachmentMetadata(filename: string, mimeType: string, sizeBytes: number) {
  return {
    filename,
    mimeType: mimeType || "application/octet-stream",
    sizeBytes,
    isImage: mimeType.startsWith("image/"),
    extension: extname(filename).toLowerCase(),
  };
}
