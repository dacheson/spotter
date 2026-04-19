# Architecture

## Layers

1. CLI layer
2. Discovery layer
3. Scenario layer
4. Generation layer
5. Execution layer
6. Reporting layer

## Core Principles

* Deterministic first
* AI is an optional enhancement
* Outputs are owned by the repository
* CI friendly
* Low configuration by default

## Data Flow

```txt
Repo -> Scan -> Signals -> Scenarios -> Tests -> Screenshots -> Diffs -> Reports
```

## Key Technology Choices

* TypeScript
* ts-morph for AST analysis
* Playwright
* Commander.js
* zod for schemas
* Optional OpenAI or local LLM providers

## Discovery Responsibilities

The scanner should detect:

* Framework and package manager
* Routes
* Dynamic route segments
* UI state signals such as loading, error, empty, modal, form, auth gating, and role checks

## Scenario Responsibilities

The scenario engine should:

* Create deterministic baseline scenarios for every route
* Add form validation coverage where applicable
* Add loading and error scenarios when supported by code signals
* Accept LLM-proposed scenarios only after validation and deduplication

## Execution Responsibilities

The Playwright layer should support:

* Screenshot generation
* Viewport setup
* Auth fixtures
* Network interception
* Locale switching
* Feature flag control