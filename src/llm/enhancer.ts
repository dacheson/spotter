import type { ComponentSignalFinding, ComponentStateHeuristic } from '../scanner/index.js';
import { prioritizeScenarios, type PrioritizeScenariosOptions } from '../scenarios/index.js';
import type { RouteDefinition, ScenarioDefinition } from '../types.js';

import type { LlmEnhancementProposal, LlmProvider } from './provider.js';

export interface ScenarioEnhancerInput {
  existingScenarios?: ScenarioDefinition[];
  heuristicsByRoute?: Record<string, ComponentStateHeuristic[]>;
  instructions?: string;
  provider: LlmProvider;
  routes: RouteDefinition[];
  signalKindsByRoute?: PrioritizeScenariosOptions['signalKindsByRoute'];
  signals: ComponentSignalFinding[];
}

export interface ScenarioEnhancerResult {
  proposal: LlmEnhancementProposal;
}

export async function enhanceScenarios(
  input: ScenarioEnhancerInput
): Promise<ScenarioEnhancerResult> {
  const proposal = await input.provider.enhanceScenarios(createEnhancementInput(input));

  const routesByPath = Object.fromEntries(input.routes.map((route) => [route.path, route]));
  const prioritizedScenarios = prioritizeScenarios(proposal.scenarios, createPrioritizeOptions(input, routesByPath));

  return {
    proposal: {
      ...proposal,
      scenarios: prioritizedScenarios
    }
  };
}

function createEnhancementInput(input: ScenarioEnhancerInput) {
  const enhancementInput: {
    existingScenarios?: ScenarioDefinition[];
    instructions?: string;
    routes: RouteDefinition[];
    signals: ComponentSignalFinding[];
  } = {
    routes: input.routes,
    signals: input.signals
  };

  if (input.existingScenarios) {
    enhancementInput.existingScenarios = input.existingScenarios;
  }

  if (input.instructions) {
    enhancementInput.instructions = input.instructions;
  }

  return enhancementInput;
}

function createPrioritizeOptions(
  input: ScenarioEnhancerInput,
  routesByPath: Record<string, RouteDefinition>
): PrioritizeScenariosOptions {
  const options: PrioritizeScenariosOptions = {
    routesByPath
  };

  if (input.heuristicsByRoute) {
    options.heuristicsByRoute = input.heuristicsByRoute;
  }

  if (input.signalKindsByRoute) {
    options.signalKindsByRoute = input.signalKindsByRoute;
  }

  return options;
}