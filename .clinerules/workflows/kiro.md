# Workflow: Recursive Task Implementation

Follow these steps precisely when implementing any task from the ledger.

## STEP 1: CONTEXT RECURSION
- **Scan `tasks.md`**: Find the Task ID and the associated `_Requirements` string.
- **Extract Requirements**: Retrieve the full Acceptance Criteria for those IDs from `requirements.md`.
- **Map Properties**: Identify which "Correctness Property" from `design.md` applies to this task.

## STEP 2: TEST-DRIVEN VERIFICATION
- **Property Test First**: Before implementing logic, write a `fast-check` test in `tests/property/`.
- **Comment Protocol**: Include the feature name and property number in the test header (e.g., `Property 1: Deck Composition`).
- **Fail First**: Run `bun test` to ensure the test fails as expected before code is written.

## STEP 3: CODE IMPLEMENTATION
- **Logic**: Write the TypeScript implementation in the directory specified in `tasks.md`.
- **Haptics**: If the task involves user turns, wins, or declaration, implement the corresponding `HapticController` trigger.
- **Validation**: Ensure re-deal logic (Property 4.1) is integrated if the task involves the dealing phase.

## STEP 4: CLOSURE
- **Verify**: Run `bun test`. If it passes, the task is complete.
- **Log**: Mark the task as `[x]` in `tasks.md`.