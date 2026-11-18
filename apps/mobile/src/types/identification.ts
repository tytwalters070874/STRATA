export type ConfidenceTier = 'high' | 'moderate' | 'low';

/** Response body of the identify-rock Edge Function. */
export interface IdentificationResult {
  identification_id: string | null;
  rock_type: string;
  /**
   * @deprecated Always null since prompt rock-id-v2: the photo identifies the
   * rock type only and the formation comes from the map. Use mapped_formation.
   */
  formation_guess: null;
  confidence: number;
  confidence_tier: ConfidenceTier;
  reasoning: string;
  minerals_visible: string[];
  /**
   * Up to three other plausible rock types, most likely first (prompt
   * rock-id-v3). Absent from responses made before v3.
   */
  alternates?: { rock_type: string; confidence: number }[];
  mapped_formation: {
    id: string;
    name: string;
    map_unit_symbol: string | null;
    geologic_age: string | null;
  } | null;
  ai_provider: 'anthropic' | 'openai';
  model: string;
  prompt_version: string;
}
