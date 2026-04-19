# AGENTS.md

## Purpose

This repository is building Spotter, a deterministic-first CLI that discovers frontend UX scenarios and turns them into Playwright visual regression coverage.

## Agent Rules

* Keep code modular
* Prefer pure functions where practical
* Add tests for generators and scanners
* Avoid hidden magic
* Output readable errors
* Preserve backward compatibility where possible

## Coding Style

* TypeScript strict mode
* Named exports
* Small files
* Clear interfaces

## Definition of Done

* Code compiles
* Tests pass
* Docs are updated when behavior changes
* An example or fixture is included when useful

## Delivery Priorities

1. Deterministic repository analysis before LLM enhancement
2. Clear generated outputs that are easy to review in git
3. CI-friendly commands and artifacts
4. Low-configuration developer experience