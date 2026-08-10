import { tryCreateClient } from "./supabase/client";

export const DEAL_FILES_BUCKET = "deal-files";

export function cloudFilePath(
  userId: string,
  dealId: string,
  fileId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 80);
  return `${userId}/${dealId}/${fileId}-${safe}`;
}

export async function uploadDealFileCloud(
  path: string,
  blob: Blob,
  contentType: string,
): Promise<{ error?: string }> {
  const sb = tryCreateClient();
  if (!sb) return { error: "Cloud not configured" };
  const { error } = await sb.storage.from(DEAL_FILES_BUCKET).upload(path, blob, {
    contentType,
    upsert: true,
  });
  if (error) return { error: error.message };
  return {};
}

export async function removeDealFileCloud(
  path: string,
): Promise<{ error?: string }> {
  const sb = tryCreateClient();
  if (!sb) return { error: "Cloud not configured" };
  const { error } = await sb.storage.from(DEAL_FILES_BUCKET).remove([path]);
  if (error) return { error: error.message };
  return {};
}

/** Short-lived signed URL for preview/download. */
export async function signedDealFileUrl(
  path: string,
  expiresSec = 3600,
): Promise<string | null> {
  const sb = tryCreateClient();
  if (!sb) return null;
  const { data, error } = await sb.storage
    .from(DEAL_FILES_BUCKET)
    .createSignedUrl(path, expiresSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
