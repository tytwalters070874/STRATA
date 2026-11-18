// identify-rock: identifies a rock from a photo using Claude vision, with the
// geologic formation mapped at the photo's GPS location as context. Falls back
// to OpenAI if the Anthropic call fails. Every attempt is recorded in
// public.identifications. The app uploads the photo to the rock-photos bucket
// and passes its path; this function reads it from there.

import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Used when the active prompt row has no fallback_model and the
// OPENAI_FALLBACK_MODEL secret is unset.
const DEFAULT_OPENAI_FALLBACK_MODEL = "gpt-4o";
const PRIMARY_PROVIDER = "anthropic";
const ROCK_PHOTOS_BUCKET = "rock-photos";

// Anthropic rejects images over 5 MB; the app resizes well below this.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ImageMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

// The two calls run one after the other, and the SDKs are set to no retries
// (a retry would repeat the whole timeout). Worst case is 60 s + 45 s = 105 s,
// which stays inside the Edge Function wall-clock limit.
const ANTHROPIC_TIMEOUT_MS = 60_000;
const OPENAI_TIMEOUT_MS = 45_000;

// Identifications allowed per user in any rolling 24 hours. Every attempt
// counts, including failures, since those still cost API calls. Override with
// the IDENTIFY_DAILY_LIMIT secret.
const DEFAULT_DAILY_LIMIT = 20;
const LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Types ──────────────────────────────────────────────────────────────────

interface IdentifyRequest {
  /**
   * Inline image. Optional when photo_path is given: the function then reads
   * the photo from Storage, so the app uploads it only once. Kept for older
   * app builds that still send both.
   */
  image_base64?: string;
  media_type: ImageMediaType;
  lat: number;
  lng: number;
  accuracy_m?: number;
  /** Path of the uploaded photo in Storage; must be under `${user.id}/`. */
  photo_path?: string;
}

/** A request whose image has been resolved to base64, ready for a provider. */
type ReadyRequest = IdentifyRequest & { image_base64: string };

// The photo identifies the rock type only; the formation comes from the map.
// The model is not asked for a formation (prompt rock-id-v2 onward).
interface Alternate {
  rock_type: string;
  confidence: number;
}

interface ModelResult {
  rock_type: string;
  confidence: number;
  reasoning: string;
  minerals_visible: string[];
  /** Up to three other plausible rock types, most likely first (PRD 3.2, prompt rock-id-v3). */
  alternates: Alternate[];
}

const MAX_ALTERNATES = 3;

type ConfidenceTier = "high" | "moderate" | "low";

interface MappedFormation {
  id: string;
  name: string;
  map_unit_symbol: string | null;
  geologic_age: string | null;
  rock_types: string[] | null;
  description: string | null;
}

interface PromptVersion {
  version: string;
  system_prompt: string;
  model: string;
  fallback_model: string | null;
}

interface ProviderOutcome {
  result: ModelResult;
  provider: "anthropic" | "openai";
  model: string;
  raw: unknown;
}

// Shared by both providers. Both require every property listed in `required`
// and `additionalProperties: false`. With no formation property here, the
// model cannot return a formation even if a prompt row asks for one.
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    rock_type: { type: "string" },
    confidence: { type: "number", description: "Probability from 0 to 1 that rock_type is correct." },
    reasoning: { type: "string" },
    minerals_visible: { type: "array", items: { type: "string" } },
    // No maxItems: not every provider's strict mode supports it. The prompt
    // asks for up to three and the parser keeps three.
    alternates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rock_type: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["rock_type", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["rock_type", "confidence", "reasoning", "minerals_visible", "alternates"],
  additionalProperties: false,
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────

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

function dailyLimit(): number {
  const parsed = Number.parseInt(Deno.env.get("IDENTIFY_DAILY_LIMIT") ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT;
}

function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "moderate";
  return "low";
}

/** Validates model output at runtime; structured outputs make failures rare but not impossible. */
function parseModelResult(text: string): ModelResult {
  const data = JSON.parse(text);
  const valid =
    typeof data?.rock_type === "string" &&
    typeof data.confidence === "number" &&
    Number.isFinite(data.confidence) &&
    typeof data.reasoning === "string" &&
    Array.isArray(data.minerals_visible) &&
    data.minerals_visible.every((m: unknown) => typeof m === "string");
  if (!valid) throw new Error(`Model output did not match schema: ${text.slice(0, 500)}`);

  const rockType = data.rock_type.trim();
  return {
    rock_type: rockType,
    confidence: Math.min(1, Math.max(0, data.confidence)),
    reasoning: data.reasoning.trim(),
    // Duplicates would make the app render two chips with the same React key.
    minerals_visible: [...new Set<string>(data.minerals_visible.map((m: string) => m.trim()))],
    alternates: parseAlternates(data.alternates, rockType),
  };
}

/**
 * Keeps well-formed alternates that differ from the main rock type, one per
 * rock type, most likely first, at most three. Missing or malformed input
 * (older prompts, a provider ignoring the schema) gives an empty list rather
 * than failing the identification.
 */
function parseAlternates(raw: unknown, rockType: string): Alternate[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set([rockType.toLowerCase()]);
  const alternates: Alternate[] = [];
  for (const item of raw) {
    if (typeof item?.rock_type !== "string" || typeof item?.confidence !== "number") continue;
    if (!Number.isFinite(item.confidence)) continue;
    const name = item.rock_type.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    alternates.push({ rock_type: name, confidence: Math.min(1, Math.max(0, item.confidence)) });
  }
  return alternates.sort((a, b) => b.confidence - a.confidence).slice(0, MAX_ALTERNATES);
}

function validateRequest(body: unknown): IdentifyRequest | string {
  if (typeof body !== "object" || body === null) return "Body must be a JSON object";
  const b = body as Record<string, unknown>;

  const hasInlineImage = typeof b.image_base64 === "string" && b.image_base64.length > 0;
  const hasPhotoPath = typeof b.photo_path === "string" && b.photo_path.length > 0;
  if (!hasInlineImage && !hasPhotoPath) return "photo_path or image_base64 is required";
  if (b.image_base64 !== undefined && typeof b.image_base64 !== "string") return "image_base64 must be a string";
  if (typeof b.lat !== "number" || b.lat < -90 || b.lat > 90) return "lat must be a number between -90 and 90";
  if (typeof b.lng !== "number" || b.lng < -180 || b.lng > 180) return "lng must be a number between -180 and 180";
  if (b.accuracy_m !== undefined && typeof b.accuracy_m !== "number") return "accuracy_m must be a number";
  if (b.photo_path !== undefined && typeof b.photo_path !== "string") return "photo_path must be a string";
  if (b.media_type !== undefined && !ALLOWED_MEDIA_TYPES.includes(b.media_type as ImageMediaType)) {
    return `media_type must be one of ${ALLOWED_MEDIA_TYPES.join(", ")}`;
  }

  let image_base64: string | undefined;
  if (hasInlineImage) {
    // Accept a data URL as well as bare base64.
    image_base64 = (b.image_base64 as string).replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
    const approxBytes = Math.floor((image_base64.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) return "Image is larger than 5 MB; resize before uploading";
  }

  return {
    image_base64,
    media_type: (b.media_type as ImageMediaType | undefined) ?? "image/jpeg",
    lat: b.lat,
    lng: b.lng,
    accuracy_m: b.accuracy_m as number | undefined,
    photo_path: b.photo_path as string | undefined,
  };
}

type Bytes = Uint8Array<ArrayBuffer>;

async function sha256Hex(bytes: Bytes): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function base64ToBytes(base64: string): Bytes {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
  // String.fromCharCode with a spread overflows the call stack on large
  // arrays, so convert in chunks.
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

type ServiceClient = SupabaseClient;

/**
 * Loads the image to identify: from Storage when the app uploaded it (the
 * normal path), otherwise from the inline base64 sent by older app builds.
 */
async function loadImage(
  supabase: ServiceClient,
  req: IdentifyRequest,
): Promise<{ base64: string; bytes: Bytes; mediaType: ImageMediaType } | string> {
  if (req.image_base64) {
    return { base64: req.image_base64, bytes: base64ToBytes(req.image_base64), mediaType: req.media_type };
  }

  const { data, error } = await supabase.storage.from(ROCK_PHOTOS_BUCKET).download(req.photo_path!);
  if (error || !data) {
    console.error("Photo download failed", error);
    return "Photo not found. Please retake it.";
  }
  if (data.size > MAX_IMAGE_BYTES) return "Image is larger than 5 MB; resize before uploading";

  const bytes = new Uint8Array(await data.arrayBuffer());
  // The bucket only accepts JPEGs; trust the stored type only if it is one we allow.
  const mediaType = ALLOWED_MEDIA_TYPES.includes(data.type as ImageMediaType)
    ? (data.type as ImageMediaType)
    : "image/jpeg";
  return { base64: bytesToBase64(bytes), bytes, mediaType };
}

/** Best-effort removal of a photo whose identification won't be kept. */
async function removePhoto(supabase: ServiceClient, path: string | undefined) {
  if (!path) return;
  const { error } = await supabase.storage.from(ROCK_PHOTOS_BUCKET).remove([path]);
  if (error) console.error("Failed to remove photo", path, error);
}

function buildContext(req: IdentifyRequest, formation: MappedFormation | null): string {
  const lines = [
    `Photo location: ${req.lat.toFixed(5)}, ${req.lng.toFixed(5)}` +
      (req.accuracy_m != null ? ` (GPS accuracy ±${Math.round(req.accuracy_m)} m)` : ""),
  ];

  if (formation) {
    lines.push(
      "",
      "Formation mapped at this location (USGS SGMC):",
      `- Name: ${formation.name}`,
      formation.map_unit_symbol ? `- Map unit: ${formation.map_unit_symbol}` : "",
      formation.geologic_age ? `- Age: ${formation.geologic_age}` : "",
      formation.rock_types?.length ? `- Rock types: ${formation.rock_types.join(", ")}` : "",
      formation.description ? `- Description: ${formation.description}` : "",
    );
  } else {
    lines.push("", "No mapped formation is available for this location.");
  }

  lines.push("", "Identify the rock in the photo.");
  return lines.filter((line, i, all) => line !== "" || all[i - 1] !== "").join("\n");
}

// ── Providers ──────────────────────────────────────────────────────────────

async function identifyWithAnthropic(
  req: ReadyRequest,
  prompt: PromptVersion,
  context: string,
): Promise<ProviderOutcome> {
  const client = new Anthropic({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    timeout: ANTHROPIC_TIMEOUT_MS,
    maxRetries: 0,
  });

  const response = await client.messages.create({
    model: prompt.model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: RESULT_SCHEMA },
    },
    system: prompt.system_prompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: req.media_type, data: req.image_base64 },
          },
          { type: "text", text: context },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Anthropic refused: ${response.stop_details?.category ?? "unknown category"}`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Anthropic response hit max_tokens");
  }

  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("Anthropic response had no text block");

  return {
    result: parseModelResult(text.text),
    provider: "anthropic",
    model: response.model,
    raw: { id: response.id, stop_reason: response.stop_reason, usage: response.usage, output: text.text },
  };
}

async function identifyWithOpenAI(
  req: ReadyRequest,
  prompt: PromptVersion,
  context: string,
): Promise<ProviderOutcome> {
  const client = new OpenAI({
    apiKey: requireEnv("OPENAI_API_KEY"),
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: 0,
  });

  const response = await client.chat.completions.create({
    model: prompt.fallback_model ?? Deno.env.get("OPENAI_FALLBACK_MODEL") ?? DEFAULT_OPENAI_FALLBACK_MODEL,
    max_tokens: 2000,
    response_format: {
      type: "json_schema",
      json_schema: { name: "rock_identification", strict: true, schema: RESULT_SCHEMA },
    },
    messages: [
      { role: "system", content: prompt.system_prompt },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${req.media_type};base64,${req.image_base64}` } },
          { type: "text", text: context },
        ],
      },
    ],
  });

  const choice = response.choices[0];
  if (choice?.message.refusal) throw new Error(`OpenAI refused: ${choice.message.refusal}`);
  if (choice?.finish_reason === "length") throw new Error("OpenAI response hit max_tokens");
  const content = choice?.message.content;
  if (!content) throw new Error("OpenAI response had no content");

  return {
    result: parseModelResult(content),
    provider: "openai",
    model: response.model,
    raw: { id: response.id, finish_reason: choice.finish_reason, usage: response.usage, output: content },
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (request) => {
  const requestStart = Date.now();
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The service-role client bypasses RLS, so identify the caller explicitly.
  const jwt = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Missing Authorization header" }, 401);
  const { data: auth, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !auth.user) return json({ error: "Not signed in" }, 401);
  const userId = auth.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be valid JSON" }, 400);
  }
  const req = validateRequest(body);
  if (typeof req === "string") return json({ error: req }, 400);
  // The service-role client reads this path, so allow only a single file
  // directly inside the caller's folder (no `..` or nested segments).
  if (req.photo_path && !/^[^/]+\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(req.photo_path)) {
    return json({ error: "photo_path is not valid" }, 400);
  }
  if (req.photo_path && !req.photo_path.startsWith(`${userId}/`)) {
    return json({ error: "photo_path must be in your own folder" }, 403);
  }

  const [promptResult, formationResult, image] = await Promise.all([
    supabase
      .from("prompt_versions")
      .select("version, system_prompt, model, fallback_model")
      .eq("is_active", true)
      .eq("ai_provider", PRIMARY_PROVIDER)
      .order("deployed_at", { ascending: false })
      .limit(1)
      .maybeSingle<PromptVersion>(),
    supabase.rpc("get_formation_at", { lat: req.lat, lng: req.lng }).maybeSingle<MappedFormation>(),
    loadImage(supabase, req),
  ]);

  if (typeof image === "string") return json({ error: image }, 400);
  const readyReq: ReadyRequest = { ...req, image_base64: image.base64, media_type: image.mediaType };
  const photoHash = await sha256Hex(image.bytes);

  if (promptResult.error || !promptResult.data) {
    console.error("No active prompt version", promptResult.error);
    return json({ error: "Identification is not configured" }, 500);
  }
  if (formationResult.error) {
    // Not fatal: identify without location context.
    console.error("Formation lookup failed", formationResult.error);
  }

  const prompt = promptResult.data;
  const formation = formationResult.data ?? null;
  const context = buildContext(req, formation);

  const baseRow = {
    user_id: userId,
    photo_path: req.photo_path ?? null,
    photo_hash: photoHash,
    location: `SRID=4326;POINT(${req.lng} ${req.lat})`,
    location_accuracy_m: req.accuracy_m ?? null,
    formation_id: formation?.id ?? null,
    prompt_version: prompt.version,
  };

  // Record the attempt before calling any model, then count. Inserting first
  // means concurrent requests see each other (so a burst can't slip past the
  // limit), and an attempt still counts if the function times out mid-call.
  const { data: pending, error: pendingError } = await supabase
    .from("identifications")
    .insert({ ...baseRow, status: "pending" })
    .select("id, created_at")
    .single<{ id: string; created_at: string }>();
  if (pendingError || !pending) {
    // Fail closed: without a row the limit can't be enforced.
    console.error("Failed to record identification attempt", pendingError);
    return json({ error: "Could not start identification. Please try again." }, 500);
  }

  const limit = dailyLimit();
  const windowStart = new Date(Date.now() - LIMIT_WINDOW_MS).toISOString();
  const { count, error: countError } = await supabase
    .from("identifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gt("created_at", windowStart);
  if (countError || count == null) {
    console.error("Failed to count identifications", countError);
    await supabase.from("identifications").delete().eq("id", pending.id);
    return json({ error: "Could not start identification. Please try again." }, 500);
  }

  if (count > limit) {
    await supabase.from("identifications").delete().eq("id", pending.id);
    // The attempt is discarded, so its photo is too.
    await removePhoto(supabase, req.photo_path);

    // The next slot opens when enough older attempts leave the window to bring
    // the count below the limit.
    const earlier = count - 1;
    const { data: blocking } = await supabase
      .from("identifications")
      .select("created_at")
      .eq("user_id", userId)
      .gt("created_at", windowStart)
      .order("created_at", { ascending: true })
      .range(earlier - limit, earlier - limit)
      .maybeSingle<{ created_at: string }>();
    const retryAt = blocking
      ? new Date(new Date(blocking.created_at).getTime() + LIMIT_WINDOW_MS).toISOString()
      : null;

    return json(
      {
        error: `Daily limit reached: ${limit} identifications per 24 hours. Try again later.`,
        code: "daily_limit",
        limit,
        retry_at: retryAt,
      },
      429,
    );
  }

  let outcome: ProviderOutcome | null = null;
  const failures: { provider: string; error: string; duration_ms: number }[] = [];
  // Model latency, recorded so model and effort choices can be compared on
  // real traffic.
  let modelMs = 0;

  for (const attempt of [identifyWithAnthropic, identifyWithOpenAI]) {
    const attemptStart = Date.now();
    try {
      outcome = await attempt(readyReq, prompt, context);
      modelMs = Date.now() - attemptStart;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const provider = attempt === identifyWithAnthropic ? "anthropic" : "openai";
      console.error(`${provider} identification failed:`, message);
      failures.push({ provider, error: message, duration_ms: Date.now() - attemptStart });
    }
  }

  if (!outcome) {
    // A failed attempt can't be saved to the catalog, so don't keep its photo.
    // The row stays (it counts toward the limit and records the failures).
    await removePhoto(supabase, req.photo_path);
    await supabase
      .from("identifications")
      .update({
        status: "failed",
        photo_path: null,
        ai_response_raw: { failures },
        completed_at: new Date().toISOString(),
      })
      .eq("id", pending.id);
    return json({ error: "Identification failed. Please try again." }, 502);
  }

  const tier = confidenceTier(outcome.result.confidence);

  const { error: updateError } = await supabase
    .from("identifications")
    .update({
      confidence_score: Number(outcome.result.confidence.toFixed(3)),
      confidence_tier: tier,
      ai_provider: outcome.provider,
      ai_response_raw: {
        ...(outcome.raw as object),
        model: outcome.model,
        result: outcome.result,
        failures,
        model_ms: modelMs,
        total_ms: Date.now() - requestStart,
      },
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .eq("id", pending.id);

  if (updateError) {
    // Still return the result; the user shouldn't lose it over a logging failure.
    console.error("Failed to save identification", updateError);
  }

  return json({
    identification_id: updateError ? null : pending.id,
    rock_type: outcome.result.rock_type,
    // Always null now. Kept so app builds that still read the field get a
    // value of the type they expect.
    formation_guess: null,
    confidence: outcome.result.confidence,
    confidence_tier: tier,
    reasoning: outcome.result.reasoning,
    minerals_visible: outcome.result.minerals_visible,
    alternates: outcome.result.alternates,
    mapped_formation: formation
      ? {
        id: formation.id,
        name: formation.name,
        map_unit_symbol: formation.map_unit_symbol,
        geologic_age: formation.geologic_age,
      }
      : null,
    ai_provider: outcome.provider,
    model: outcome.model,
    prompt_version: prompt.version,
  });
});
