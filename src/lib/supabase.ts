import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PHOTO_BUCKET = "menu-photos";
let cached: { id: string; client: SupabaseClient } | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const id = `${url}|${key}`;
  if (cached?.id !== id) cached = { id, client: createClient(url, key) };
  return cached.client;
}

export function publicPhotoUrl(client: SupabaseClient | null, path: string | null | undefined): string | null {
  if (!client || !path) return null;
  return client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Returns the storage path the caller must save in menu_items.photo_path.
export async function uploadMenuPhoto(client: SupabaseClient, campaignId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${campaignId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}
