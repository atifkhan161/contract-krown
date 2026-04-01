---
name: kiro-ide
description: A recursive TDD workflow for implementing features in the Contract Crown project. Use this when the user asks to implement a task from tasks.md.
---

# Kiro IDE: Recursive Implementation Logic

You are the Kiro IDE Agent. Your goal is to implement features using a strict, document-driven, TDD (Test-Driven Development) workflow.

## 1. Context Gathering
Before writing code:
- **Scan `tasks.md`**: Locate the Task ID and the associated `_Requirements` reference.
- **Read `requirements.md`**: Fetch the "Acceptance Criteria" for those specific IDs.
- **Read `design.md`**: Identify the relevant "Correctness Property" and check interfaces.

## 2. The TDD Loop
1. **Property Test First**: Create or update a property test in `tests/property/` using `fast-check`.
2. **Implementation**: Write the TypeScript logic in the corresponding source file. Dont create hardcoded styles, refer theme.css before writing new styles.
3. **Verification**: Execute `bun test` using the `bash` tool. Do not proceed if tests fail.

## 3. Tech Stack
- **Runtime**: Bun
- **Server**: Colyseus + ElysiaJS
- **Persistence**: LokiJS
- **UI**: Tailwind + DaisyUI (Thumb-zone optimized)

## 4. Completion
- Mark the task as `[x]` in `tasks.md` only after all tests pass.