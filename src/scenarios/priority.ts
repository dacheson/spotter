import type { ComponentStateHeuristic, ComponentSignalKind } from '../scanner/index.js';
import type { RouteDefinition, ScenarioDefinition, ScenarioPriority } from '../types.js';

export interface ScenarioPriorityReason {
  code: string;
  weight: number;
  message: string;
}

export interface ScenarioPriorityEvaluation {
  priority: ScenarioPriority;
  reasons: ScenarioPriorityReason[];
  score: number;
}

export interface PrioritizeScenariosOptions {
  heuristicsByRoute?: Record<string, ComponentStateHeuristic[]>;
  routesByPath?: Record<string, RouteDefinition>;
  signalKindsByRoute?: Record<string, ComponentSignalKind[]>;
}

const highPriorityTagPattern = /auth|role|admin|permission|payment|checkout|security/i;
const mediumPriorityTagPattern = /error|form|validation|loading|empty|modal/i;
const highPriorityRoutePattern = /checkout|payment|billing|account|admin|settings/i;

export function prioritizeScenarios(
  scenarios: ScenarioDefinition[],
  options: PrioritizeScenariosOptions = {}
): ScenarioDefinition[] {
  return scenarios.map((scenario) => ({
    ...scenario,
    priority: evaluateScenarioPriority(scenario, createPriorityContext(scenario, options)).priority
  }));
}

export function evaluateScenarioPriority(
  scenario: ScenarioDefinition,
  context: {
    heuristics?: ComponentStateHeuristic[];
    route?: RouteDefinition;
    signalKinds?: ComponentSignalKind[];
  } = {}
): ScenarioPriorityEvaluation {
  const heuristics = context.heuristics ?? [];
  const signalKinds = context.signalKinds ?? [];
  const reasons: ScenarioPriorityReason[] = [];

  if (context.route?.dynamic) {
    reasons.push({
      code: 'dynamic-route',
      weight: 1,
      message: 'Dynamic routes usually cover more execution paths.'
    });
  }

  if (highPriorityRoutePattern.test(scenario.routePath)) {
    reasons.push({
      code: 'critical-route',
      weight: 2,
      message: 'The route matches a high-risk user flow.'
    });
  }

  if (scenario.tags.some((tag) => highPriorityTagPattern.test(tag))) {
    reasons.push({
      code: 'critical-tag',
      weight: 3,
      message: 'Scenario tags indicate a high-risk area such as auth, roles, or checkout.'
    });
  }

  if (scenario.tags.some((tag) => mediumPriorityTagPattern.test(tag))) {
    reasons.push({
      code: 'state-tag',
      weight: 1,
      message: 'Scenario tags indicate explicit UI state coverage.'
    });
  }

  if (heuristics.some((heuristic) => heuristic.kind === 'error' || heuristic.kind === 'form')) {
    reasons.push({
      code: 'state-heuristic',
      weight: 2,
      message: 'Route-level heuristics show error or form handling.'
    });
  } else if (heuristics.some((heuristic) => heuristic.kind === 'loading')) {
    reasons.push({
      code: 'loading-heuristic',
      weight: 1,
      message: 'Route-level heuristics show a loading state.'
    });
  }

  if (signalKinds.includes('auth') || signalKinds.includes('role')) {
    reasons.push({
      code: 'access-signal',
      weight: 2,
      message: 'Route-level signals show auth or role gating.'
    });
  }

  const score = reasons.reduce((total, reason) => total + reason.weight, 0);

  return {
    priority: mapScoreToPriority(score),
    reasons,
    score
  };
}

function mapScoreToPriority(score: number): ScenarioPriority {
  if (score >= 5) {
    return 'high';
  }

  if (score >= 2) {
    return 'medium';
  }

  return 'low';
}

function createPriorityContext(
  scenario: ScenarioDefinition,
  options: PrioritizeScenariosOptions
): {
  heuristics?: ComponentStateHeuristic[];
  route?: RouteDefinition;
  signalKinds?: ComponentSignalKind[];
} {
  const context: {
    heuristics?: ComponentStateHeuristic[];
    route?: RouteDefinition;
    signalKinds?: ComponentSignalKind[];
  } = {
    heuristics: options.heuristicsByRoute?.[scenario.routePath] ?? [],
    signalKinds: options.signalKindsByRoute?.[scenario.routePath] ?? []
  };

  const route = options.routesByPath?.[scenario.routePath];

  if (route) {
    context.route = route;
  }

  return context;
}