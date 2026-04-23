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

export interface ConfiguredLlmProviderOptions {
  apiKeyEnvVar?: string;
  baseUrl?: string;
  model: string;
  provider: LlmProviderName;
}

export function createLlmProvider(options: CreateLlmProviderOptions): LlmProvider {
  if (options.provider === 'mock') {
    return createMockLlmProvider(options);
  }

  return createInvokerLlmProvider(options);
}

export function createConfiguredLlmProvider(options: ConfiguredLlmProviderOptions): LlmProvider {
  if (options.provider === 'mock') {
    return createLlmProvider({
      provider: 'mock',
      model: options.model
    });
  }

  return createLlmProvider({
    provider: options.provider,
    model: options.model,
    invoker: createOpenAiCompatibleInvoker(options)
  });
}

export function buildScenarioEnhancementPrompts(input: LlmEnhancementInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt =
    'You are Spotter, a deterministic-first UX scenario planner. Return JSON only. Suggest only missing scenarios that add clear coverage value. Do not repeat existing scenarios. If no routes are provided, prefer routePath "/" unless the repo context clearly supports another user-facing path.';
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
    'Route guidance:',
    input.routes.length > 0
      ? 'Use the listed routes when proposing routePath values.'
      : 'No deterministic routes were found. Default routePath to "/" unless the repo context clearly supports another user-facing path.',
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

function createOpenAiCompatibleInvoker(options: ConfiguredLlmProviderOptions): LlmProviderInvoker {
  return async (request: LlmProviderRequest): Promise<LlmProviderResponse> => {
    const baseUrl = options.baseUrl ?? (options.provider === 'openai' ? 'https://api.openai.com/v1' : 'http://127.0.0.1:11434/v1');
    const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const apiKeyEnvVar = options.apiKeyEnvVar ?? (options.provider === 'openai' ? 'OPENAI_API_KEY' : undefined);

    if (apiKeyEnvVar) {
      const apiKey = process.env[apiKeyEnvVar];

      if (!apiKey) {
        throw new Error(`LLM provider ${options.provider} requires ${apiKeyEnvVar} to be set.`);
      }

      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model,
        messages: [
          {
            role: 'system',
            content: request.systemPrompt
          },
          {
            role: 'user',
            content: request.userPrompt
          }
        ],
        response_format: request.jsonOnly ? { type: 'json_object' } : undefined
      })
    });

    if (!response.ok) {
      throw new Error(`LLM provider ${options.provider} request failed with ${response.status}.`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ text?: string; type?: string }> } }>;
    };
    const rawText = extractResponseText(payload.choices?.[0]?.message?.content);

    return {
      rawText,
      proposal: parseJsonPayload(rawText)
    };
  };
}

function extractResponseText(
  content: string | Array<{ text?: string; type?: string }> | undefined
): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => entry.text ?? '')
      .join('')
      .trim();
  }

  return '';
}

function parseJsonPayload(rawText: string): unknown {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error('LLM provider returned an empty response.');
  }

  const normalized = trimmed.startsWith('```') ? trimmed.replace(/^```(?:json)?\s*|\s*```$/g, '') : trimmed;

  try {
    return JSON.parse(normalized);
  } catch {
    const firstBrace = normalized.indexOf('{');
    const lastBrace = normalized.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(normalized.slice(firstBrace, lastBrace + 1));
    }

    throw new Error('LLM provider returned invalid JSON.');
  }
}