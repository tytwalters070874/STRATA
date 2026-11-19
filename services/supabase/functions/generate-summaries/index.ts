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

const PROMPT_VERSION = "summary-v2";
const DEFAULT_MODEL = "claude-sonnet-5-5";
const MAX_BATCH = 25;
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
- Write only about the rock. Never mention Macrostrat, maps, sources, data, matching, or which facts you used or set aside: readers see only the summary.
- If the facts are thin, stay general rather than guessing.
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

  const response = await client.messages.create({
    model,
    max_tokens: 1000,
    output_config: { effort: "low", format: { type: "json_schema", schema: RESULT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: facts.join("\n") }],
  });
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("No text in response");
  const data = JSON.parse(text.text);
  if (typeof data?.summary !== "string" || !data.summary.trim()) throw new Error("Empty summary");
  return {
    formation_name: candidate.name,
    summary: data.summary.trim(),
    how_it_formed: typeof data.how_it_formed === "string" ? data.how_it_formed.trim() || null : null,
    source: "ai",
    model: response.model,
    prompt_version: PROMPT_VERSION,
    reviewed: false,
  };
}

Deno.serve(async (request) => {
  const token = Deno.env.get("SUMMARY_JOB_TOKEN");
  // Off unless a long token is configured and sent.
  if (!token || token.length < 32 || request.headers.get("x-job-token") !== token) {
    return json({ error: "Forbidden" }, 403);
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let batch = 20;
  try {
    const body = await request.json();
    if (Number.isInteger(body?.batch)) batch = Math.min(MAX_BATCH, Math.max(1, body.batch));
  } catch {
    // Default batch.
  }

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anthropic = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY"), timeout: 30_000, maxRetries: 1 });
  const model = Deno.env.get("SUMMARY_MODEL") ?? DEFAULT_MODEL;

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
