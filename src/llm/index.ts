import type { ScenarioDefinition } from '../types.js';

export interface LlmEnhancementProposal {
  provider: string;
  model?: string;
  scenarios: ScenarioDefinition[];
}