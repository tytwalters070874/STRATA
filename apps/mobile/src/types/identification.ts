export type ConfidenceTier = 'high' | 'moderate' | 'low';

/** Response body of the identify-rock Edge Function. */
export interface IdentificationResult {
  identification_id: string | null;
  rock_type: string;
  formation_guess: string | null;
  confidence: number;
  confidence_tier: ConfidenceTier;
  reasoning: string;
  minerals_visible: string[];
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
