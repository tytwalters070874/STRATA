// generate-summaries: one-off job that writes plain-language summaries for
// formations that have none (PRD 3.1). For each formation name it looks up
// Macrostrat's description, age and environment at a point inside the
// formation, asks Claude for a short summary grounded in those facts, and
// stores it in public.formation_summaries as AI-written and unreviewed.
//
// Not for app use. It runs only when the SUMMARY_JOB_TOKEN secret is set and
// the caller sends it in the x-job-token header; unset the secret after the
// job to switch the function off.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const PROMPT_VERSION = "summary-v4";
const DEFAULT_MODEL = "claude-sonnet-5-5";
const MAX_BATCH = 25;
const MAX_AUDIT = 50;
const CONCURRENCY = 5;
const MACROSTRAT = "https://macrostrat.org/api/v2";
const SCALE_ORDER = ["large", "medium", "small", "tiny"];

const SYSTEM_PROMPT = `You write short, accurate plain-language summaries of geologic formations in Montana and Wyoming for STRATA, a field app. Readers are curious adults with little geology background who want to see the land the way a geologist does.

Write:
- summary: 2–3 sentences. Say what kind of rock this is and how it looks, roughly when it formed, and what the place was like then. Use plain words; if you use a geology term, explain it in the same sentence.
- how_it_formed: one sentence on how and where the rock formed, for example settled on the floor of a shallow sea, erupted from volcanoes, or laid down by rivers.

Rules:
- Use only the facts given: the formation name, rock types, rock class, and the Macrostrat description, age and environment. You may add widely known general geology about those rock types. Do not invent fossils, places, thicknesses or events the facts do not support.
- The Macrostrat unit comes from a different map and can describe a different rock. If it clearly does not match the formation's rock types, ignore its description and age entirely and rely on the rock types.
- Write only about the rock. Never mention Macrostrat, maps, sources, data, databases, matching, "the facts" or "the information given", or which facts you used or set aside: readers see only the summary, not what you were given.
- If the facts are thin, stay general rather than guessing. When the age is uncertain, say so about the rock ("its exact age is not well known"), not about your information.
- Give ages in plain words ("about 50 million years ago"), never "Ma".
- No headings, lists or exclamation marks.`;

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    how_it_formed: { type: "string" },
  },
  required: ["summary", "how_it_formed"],
  additionalProperties: false,
} as const;

interface Candidate {
  name: string;
  rock_types: string[] | null;
  rock_class: string | null;
  lat: number;
  lng: number;
}

interface MapUnit {
  name: string;
  descrip: string;
  lith: string;
  best_int_name: string | null;
  b_int_name: string;
  t_int_name: string;
  b_age: number;
  t_age: number;
  scale: string;
  macro_units: number[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Macrostrat answered ${response.status}`);
  return (await response.json()) as T;
}

/** Macrostrat facts at a point, as plain lines for the prompt. Empty when Macrostrat has nothing. */
async function macrostratFacts(lat: number, lng: number): Promise<string[]> {
  const map = await getJson<{ success?: { data?: MapUnit[] } }>(
    `${MACROSTRAT}/geologic_units/map?lat=${lat}&lng=${lng}&format=json`,
  );
  const units = [...(map.success?.data ?? [])].sort(
    (a, b) => SCALE_ORDER.indexOf(a.scale) - SCALE_ORDER.indexOf(b.scale),
  );
  const unit = units.find((u) => u.descrip?.trim()) ?? units[0];
  if (!unit) return [];

  const period = unit.best_int_name ??
    (unit.b_int_name === unit.t_int_name ? unit.b_int_name : `${unit.b_int_name} to ${unit.t_int_name}`);
  const lines = [
    `Macrostrat unit name: ${unit.name}`,
    `Macrostrat age: ${period}, ${Math.round(unit.t_age)}–${Math.round(unit.b_age)} million years ago`,
  ];
  if (unit.lith?.trim()) lines.push(`Macrostrat lithology: ${unit.lith}`);
  if (unit.descrip?.trim()) lines.push(`Macrostrat description: ${unit.descrip.trim()}`);

  const ids = unit.macro_units.slice(0, 5);
  if (ids.length > 0) {
    try {
      const detail = await getJson<{ success?: { data?: { environ?: { name: string }[] }[] } }>(
        `${MACROSTRAT}/units?unit_id=${ids.join(",")}&response=long&format=json`,
      );
      const environments = [
        ...new Set((detail.success?.data ?? []).flatMap((u) => (u.environ ?? []).map((e) => e.name))),
      ].filter((name) => name && !name.endsWith("indet."));
      if (environments.length > 0) lines.push(`Macrostrat environment of deposition: ${environments.join(", ")}`);
    } catch {
      // Optional detail.
    }
  }
  return lines;
}

async function summarize(client: Anthropic, model: string, candidate: Candidate) {
  const facts = [
    `Formation name: ${candidate.name}`,
    `Rock types: ${candidate.rock_types?.join(", ") || "unknown"}`,
    `Rock class: ${candidate.rock_class ?? "unknown"}`,
    ...(await macrostratFacts(candidate.lat, candidate.lng)),
  ];

  // Prompt rules alone kept leaking ("the facts given", "not given here",
  // "the details available"), so every draft is checked, and a flagged one is
  // rewritten once with the offending phrase quoted back. A second failure
  // stores nothing: a formation with no summary beats one that talks about
  // its sources.
  let rejectedQuote: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const note = rejectedQuote
      ? `\n\nA previous draft was rejected because it talked about the information it was given ("${rejectedQuote}"). Describe only the rock.`
      : "";
    const response = await client.messages.create({
      model,
      max_tokens: 1000,
      output_config: { effort: "low", format: { type: "json_schema", schema: RESULT_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: facts.join("\n") + note }],
    });
    if (response.stop_reason === "refusal") throw new Error("Model declined");
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") throw new Error("No text in response");
    const data = JSON.parse(text.text);
    if (typeof data?.summary !== "string" || !data.summary.trim()) throw new Error("Empty summary");
    const row = {
      formation_name: candidate.name,
      summary: data.summary.trim(),
      how_it_formed: typeof data.how_it_formed === "string" ? data.how_it_formed.trim() || null : null,
      source: "ai",
      model: response.model,
      prompt_version: PROMPT_VERSION,
      reviewed: false,
    };
    rejectedQuote = await selfReference(client, model, row.summary, row.how_it_formed);
    if (!rejectedQuote) return row;
  }
  throw new Error(`Still refers to its sources: "${rejectedQuote}"`);
}

const CHECK_PROMPT = `You review short texts written for readers of a geology field guide app. The writer was given facts about a rock unit; readers never see those facts, only the text.

Flag the text when it talks about the information the writer was given instead of about the rock. Examples to flag: "the facts given do not state its age", "its exact age is not given here", "from the details available", "the description gives its age as", "listed in the map data", "the database also lists", "Macrostrat", "the matching unit was set aside", "the source gives conflicting dates".

Do not flag ordinary geology that uses similar words about the rock or the land: "the source area of the sediment", "pebbles sourced from nearby mountains", "the details of that ancient landscape are not well known", "its exact age is not well known". Uncertainty is fine when it is about the rock, not about the writer's information.

If flagged, quote the shortest phrase that shows it.`;

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    refers_to_sources: { type: "boolean" },
    quote: { type: "string" },
  },
  required: ["refers_to_sources", "quote"],
  additionalProperties: false,
} as const;

/** The phrase where a summary talks about its own input, or null when it doesn't. */
async function selfReference(
  client: Anthropic,
  model: string,
  summary: string,
  howItFormed: string | null,
): Promise<string | null> {
  const response = await client.messages.create({
    model,
    max_tokens: 300,
    output_config: { effort: "low", format: { type: "json_schema", schema: CHECK_SCHEMA } },
    system: CHECK_PROMPT,
    messages: [{ role: "user", content: [summary, howItFormed].filter(Boolean).join("\n\n") }],
  });
  if (response.stop_reason === "refusal") throw new Error("Checker declined");
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("No text from checker");
  const data = JSON.parse(text.text);
  return data?.refers_to_sources ? String(data.quote || "unquoted") : null;
}

/** Checks stored summaries without changing them; returns the ones that fail. */
async function audit(
  supabase: ReturnType<typeof createClient>,
  client: Anthropic,
  model: string,
  offset: number,
  limit: number,
) {
  const { data, error } = await supabase
    .from("formation_summaries")
    .select("formation_name, summary, how_it_formed")
    .order("formation_name")
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { formation_name: string; summary: string; how_it_formed: string | null }[];

  const flagged: { name: string; quote: string }[] = [];
  const failed: { name: string; error: string }[] = [];
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const slice = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      slice.map((r) => selfReference(client, model, r.summary, r.how_it_formed)),
    );
    results.forEach((result, j) => {
      const name = slice[j].formation_name;
      if (result.status === "rejected") failed.push({ name, error: String(result.reason?.message ?? result.reason) });
      else if (result.value) flagged.push({ name, quote: result.value });
    });
  }
  return { checked: rows.length, next_offset: rows.length === limit ? offset + limit : null, flagged, failed };
}

Deno.serve(async (request) => {
  const token = Deno.env.get("SUMMARY_JOB_TOKEN");
  // Off unless a long token is configured and sent.
  if (!token || token.length < 32 || request.headers.get("x-job-token") !== token) {
    return json({ error: "Forbidden" }, 403);
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let batch = 20;
  let body: { batch?: unknown; action?: unknown; offset?: unknown; limit?: unknown } = {};
  try {
    body = await request.json();
    if (Number.isInteger(body?.batch)) batch = Math.min(MAX_BATCH, Math.max(1, body.batch as number));
  } catch {
    // Default batch.
  }

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anthropic = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY"), timeout: 30_000, maxRetries: 1 });
  const model = Deno.env.get("SUMMARY_MODEL") ?? DEFAULT_MODEL;

  // {"action": "audit", "offset": 0, "limit": 50}: read-only check of stored summaries.
  if (body?.action === "audit") {
    const offset = Number.isInteger(body.offset) ? Math.max(0, body.offset as number) : 0;
    const limit = Number.isInteger(body.limit) ? Math.min(MAX_AUDIT, Math.max(1, body.limit as number)) : MAX_AUDIT;
    try {
      return json(await audit(supabase, anthropic, model, offset, limit));
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  const { data: candidates, error } = await supabase.rpc("formations_needing_summary", { batch });
  if (error) return json({ error: error.message }, 500);
  const work = (candidates ?? []) as Candidate[];

  const written: string[] = [];
  const failed: { name: string; error: string }[] = [];
  for (let i = 0; i < work.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(work.slice(i, i + CONCURRENCY).map((c) => summarize(anthropic, model, c)));
    for (let j = 0; j < results.length; j++) {
      const name = work[i + j].name;
      const result = results[j];
      if (result.status === "rejected") {
        failed.push({ name, error: String(result.reason?.message ?? result.reason) });
        continue;
      }
      const { error: insertError } = await supabase.from("formation_summaries").upsert(result.value);
      if (insertError) failed.push({ name, error: insertError.message });
      else written.push(name);
    }
  }

  return json({ requested: work.length, written: written.length, failed });
});
