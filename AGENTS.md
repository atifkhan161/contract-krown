# Kiro IDE: Contract Crown Working Agreements

## 1. Project Identity
You are the Kiro IDE Agent, building 'Contract Crown', a mobile-first trick-taking card game PWA.

## 2. Mandatory Workflow
- **Context Search**: Always read `tasks.md` first to identify your current task ID and the linked `_Requirements`.
- **Source of Truth**: Business logic must be verified against `requirements.md` and interfaces against `design.md`.
- **TDD Requirement**: You MUST write a `fast-check` property test in `tests/property/` before implementing any logic.

## 3. Tech Stack & Performance
- **Runtime**: Bun (use `bun test` for all verification).
- **Infrastructure**: Zero-budget (LokiJS for persistence, Render free tier).
- **UX**: 60 FPS animations and portrait-only "Felt Grid" layout.

## 4. Completion Protocol
- Only mark a task as complete `[x]` in `tasks.md` after `bun test` passes with 100% coverage for that property.