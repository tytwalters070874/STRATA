// delete-account: permanently deletes the calling user and everything they
// own: rock photos in Storage, catalog entries, identifications, flags,
// offline regions and the profile row. Required by Google Play for apps that
// create accounts. Works for anonymous guests as well as email accounts.
//
// Database rows go through ON DELETE CASCADE from auth.users -> public.users
// -> each table. Storage objects have no foreign key, so they are removed
// first, explicitly.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ROCK_PHOTOS_BUCKET = "rock-photos";
// Storage list() and remove() both cap how many objects one call handles.
const PAGE_SIZE = 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/** Removes every object under `${userId}/` in the photos bucket. */
async function deletePhotos(supabase: SupabaseClient, userId: string): Promise<number> {
  const bucket = supabase.storage.from(ROCK_PHOTOS_BUCKET);
  let removed = 0;

  // Always read the first page: each pass deletes what it listed, so the next
  // listing starts with whatever is left.
  while (true) {
    const { data: objects, error: listError } = await bucket.list(userId, { limit: PAGE_SIZE });
    if (listError) throw new Error(`Could not list photos: ${listError.message}`);
    if (!objects || objects.length === 0) return removed;

    const paths = objects.map((object) => `${userId}/${object.name}`);
    const { error: removeError } = await bucket.remove(paths);
    if (removeError) throw new Error(`Could not delete photos: ${removeError.message}`);
    removed += paths.length;

    if (objects.length < PAGE_SIZE) return removed;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The service-role client bypasses RLS, so identify the caller from their
  // own token. A user can only ever delete themselves.
  const jwt = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Missing Authorization header" }, 401);
  const { data: auth, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !auth.user) return json({ error: "Not signed in" }, 401);
  const userId = auth.user.id;

  try {
    // Photos first: if this fails, nothing else has been deleted and the user
    // can retry. Deleting the account first would leave photos with no owner
    // to delete them.
    const photos = await deletePhotos(supabase, userId);

    // catalog_entries references identifications without a cascade; remove it
    // before the auth cascade so deletion order can never trip that key.
    const { error: catalogError } = await supabase.from("catalog_entries").delete().eq("user_id", userId);
    if (catalogError) throw new Error(`Could not delete catalog: ${catalogError.message}`);

    // Cascades to public.users and every table that references it.
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) throw new Error(`Could not delete account: ${deleteError.message}`);

    console.log(`Deleted account ${userId} (${photos} photos)`);
    return json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Account deletion failed for ${userId}:`, message);
    return json({ error: "Could not delete your account. Please try again." }, 500);
  }
});
