import type { ComponentSignalFinding } from '../scanner/index.js';
import type { RouteDefinition, ScenarioDefinition } from '../types.js';

import { validateLlmEnhancementProposal } from './validation.js';

export type LlmProviderName = 'mock' | 'openai' | 'local';

export interface LlmEnhancementProposal {
  provider: string;
  model?: string;
  scenarios: ScenarioDefinition[];
}

export interface LlmEnhancementInput {
  existingScenarios?: ScenarioDefinition[];
  instructions?: string;
  routes: RouteDefinition[];
  signals: ComponentSignalFinding[];
}

export interface LlmProviderMetadata {
  model?: string;
  name: LlmProviderName;
  supportsJsonOnly: boolean;
}

export interface LlmProviderRequest {
  jsonOnly: boolean;
  metadata: LlmProviderMetadata;
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmProviderResponse {
  proposal?: unknown;
  rawText: string;
}

export interface LlmProvider {
  enhanceScenarios(input: LlmEnhancementInput): Promise<LlmEnhancementProposal>;
  metadata: LlmProviderMetadata;
}

export interface LlmProviderInvoker {
  (request: LlmProviderRequest): Promise<LlmProviderResponse>;
}

export interface CreateLlmProviderOptions {
  invoker?: LlmProviderInvoker;
  mockProposal?: LlmEnhancementProposal;
  model?: string;
  provider: LlmProviderName;
}

export function createLlmProvider(options: CreateLlmProviderOptions): LlmProvider {
  if (options.provider === 'mock') {
    return createMockLlmProvider(options);
  }

  return createInvokerLlmProvider(options);
}

export function buildScenarioEnhancementPrompts(input: LlmEnhancementInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt =
    'You are Spotter, a deterministic-first UX scenario planner. Return JSON only. Suggest only missing scenarios that add clear coverage value.';
  const userPrompt = [
    'Routes:',
    JSON.stringify(input.routes, null, 2),
    '',
    'Component signals:',
    JSON.stringify(input.signals, null, 2),
    '',
    'Existing scenarios:',
    JSON.stringify(input.existingScenarios ?? [], null, 2),
    '',
    'Return JSON with shape:',
    JSON.stringify({ provider: 'provider-name', model: 'model-name', scenarios: [] }, null, 2),
    '',
    input.instructions ? `Extra instructions: ${input.instructions}` : 'Extra instructions: none'
  ].join('\n');

  return {
    systemPrompt,
    userPrompt
  };
}

function createMockLlmProvider(options: CreateLlmProviderOptions): LlmProvider {
  const metadata = createProviderMetadata('mock', options.model);

  return {
    metadata,
    async enhanceScenarios(): Promise<LlmEnhancementProposal> {
      return validateLlmEnhancementProposal(
        options.mockProposal ?? createDefaultProposal('mock', options.model)
      );
    }
  };
}

function createInvokerLlmProvider(options: CreateLlmProviderOptions): LlmProvider {
  const metadata = createProviderMetadata(options.provider, options.model);

  return {
    metadata,
    async enhanceScenarios(input: LlmEnhancementInput): Promise<LlmEnhancementProposal> {
      if (!options.invoker) {
        throw new Error(`LLM provider ${options.provider} requires an invoker implementation.`);
      }

      const prompts = buildScenarioEnhancementPrompts(input);
      const response = await options.invoker({
        jsonOnly: true,
        metadata,
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt
      });

      if (response.proposal) {
        return validateLlmEnhancementProposal(response.proposal);
      }

      throw new Error(`LLM provider ${options.provider} returned no parsed proposal.`);
    }
  };
}

function createProviderMetadata(name: LlmProviderName, model?: string): LlmProviderMetadata {
  const metadata: LlmProviderMetadata = {
    name,
    supportsJsonOnly: true
  };

  if (model) {
    metadata.model = model;
  }

  return metadata;
}

function createDefaultProposal(provider: string, model?: string): LlmEnhancementProposal {
  const proposal: LlmEnhancementProposal = {
    provider,
    scenarios: []
  };

  if (model) {
    proposal.model = model;
  }

  return proposal;
}