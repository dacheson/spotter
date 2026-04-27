import { Ajv, type ErrorObject } from 'ajv';

import type { ScenarioDefinition } from '../types.js';

import type { LlmEnhancementProposal } from './provider.js';

export interface NormalizeLlmEnhancementProposalOptions {
  existingScenarios?: ScenarioDefinition[];
  maxGeneratedScenarios?: number;
  proposal: unknown;
}

export const defaultMaxGeneratedScenarios = 25;

const ajv = new Ajv({ allErrors: true });
const validateProposalSchema = ajv.compile<LlmEnhancementProposal>({
  type: 'object',
  additionalProperties: false,
  required: ['provider', 'scenarios'],
  properties: {
    provider: {
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    },
    model: {
      type: 'string',
      minLength: 1,
      pattern: '.*\\S.*'
    },
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'routePath', 'name', 'priority', 'tags'],
        properties: {
          id: {
            type: 'string',
            minLength: 1,
            pattern: '.*\\S.*'
          },
          routePath: {
            type: 'string',
            minLength: 1,
            pattern: '.*\\S.*'
          },
          name: {
            type: 'string',
            minLength: 1,
            pattern: '.*\\S.*'
          },
          priority: {
            type: 'string',
            enum: ['high', 'medium', 'low']
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
              pattern: '.*\\S.*'
            }
          }
        }
      }
    }
  }
});

export function validateLlmEnhancementProposal(proposal: unknown): LlmEnhancementProposal {
  if (!validateProposalSchema(proposal)) {
    throw new Error(`Invalid LLM proposal: ${formatSchemaErrors(validateProposalSchema.errors)}`);
  }

  const validatedProposal = proposal as LlmEnhancementProposal;
  const normalizedProposal: LlmEnhancementProposal = {
    provider: validatedProposal.provider.trim(),
    scenarios: validatedProposal.scenarios.map(normalizeScenario)
  };

  if (validatedProposal.model) {
    normalizedProposal.model = validatedProposal.model.trim();
  }

  return normalizedProposal;
}

export function normalizeLlmEnhancementProposal(
  options: NormalizeLlmEnhancementProposalOptions
): LlmEnhancementProposal {
  const proposal = validateLlmEnhancementProposal(options.proposal);

  const normalizedProposal: LlmEnhancementProposal = {
    provider: proposal.provider,
    scenarios: mergeScenarioDefinitions(
      options.existingScenarios ?? [],
      proposal.scenarios,
      options.maxGeneratedScenarios ?? defaultMaxGeneratedScenarios
    )
  };

  if (proposal.model) {
    normalizedProposal.model = proposal.model;
  }

  return normalizedProposal;
}

function mergeScenarioDefinitions(
  existingScenarios: ScenarioDefinition[],
  generatedScenarios: ScenarioDefinition[],
  maxGeneratedScenarios: number
): ScenarioDefinition[] {
  const mergedScenarios: ScenarioDefinition[] = [];
  const seenIds = new Set<string>();
  const seenRouteNames = new Set<string>();

  for (const scenario of existingScenarios) {
    pushUniqueScenario(mergedScenarios, scenario, seenIds, seenRouteNames);
  }

  let addedGeneratedScenarioCount = 0;
  for (const scenario of generatedScenarios) {
    if (addedGeneratedScenarioCount >= maxGeneratedScenarios) {
      break;
    }

    const added = pushUniqueScenario(mergedScenarios, scenario, seenIds, seenRouteNames);
    if (added) {
      addedGeneratedScenarioCount += 1;
    }
  }

  return mergedScenarios;
}

function pushUniqueScenario(
  scenarios: ScenarioDefinition[],
  scenario: ScenarioDefinition,
  seenIds: Set<string>,
  seenRouteNames: Set<string>
): boolean {
  const normalizedScenario = normalizeScenario(scenario);
  const scenarioIdKey = createIdKey(normalizedScenario.id);
  const scenarioRouteNameKey = createRouteNameKey(normalizedScenario.routePath, normalizedScenario.name);

  if (seenIds.has(scenarioIdKey) || seenRouteNames.has(scenarioRouteNameKey)) {
    return false;
  }

  seenIds.add(scenarioIdKey);
  seenRouteNames.add(scenarioRouteNameKey);
  scenarios.push(normalizedScenario);

  return true;
}

function normalizeScenario(scenario: ScenarioDefinition): ScenarioDefinition {
  const normalizedScenario: ScenarioDefinition = {
    id: scenario.id.trim(),
    routePath: scenario.routePath.trim(),
    name: scenario.name.trim(),
    priority: scenario.priority,
    tags: Array.from(new Set(scenario.tags.map((tag) => tag.trim()).filter(Boolean)))
  };

  if (scenario.origin) {
    normalizedScenario.origin = scenario.origin;
  }

  return normalizedScenario;
}

function createIdKey(id: string): string {
  return normalizeKeyPart(id);
}

function createRouteNameKey(routePath: string, name: string): string {
  return `${normalizeKeyPart(routePath)}::${normalizeKeyPart(name)}`;
}

function normalizeKeyPart(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) {
    return 'schema validation failed.';
  }

  return errors
    .map((error) => {
      const path = error.instancePath || '(root)';
      return `${path} ${error.message ?? 'is invalid'}`;
    })
    .join('; ');
}