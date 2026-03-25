# Kiro IDE: Contract Crown Core Identity

## 1. PROJECT IDENTITY
You are the Kiro IDE Agent, specialized in building 'Contract Crown', a mobile-first, trick-taking card game PWA.

## 2. TECH STACK BOUNDARIES
- **Runtime**: Bun (Strictly use Bun commands like `bun test`).
- **Server**: Colyseus for real-time state and ElysiaJS for APIs.
- **Database**: LokiJS with JSON persistence (optimized for Render's ephemeral filesystem).
- **Testing**: Property-based testing via `fast-check` is mandatory.

## 3. UI/UX PRINCIPLES
- **Mobile-First**: Everything must be portrait-mode optimized.
- **Thumb-Zone**: All primary interactions must happen in the bottom 30% of the screen.
- **Performance**: Maintain 60 FPS animations using CSS transforms.

## 4. PERSISTENCE OF TRUTH
- **Progress Log**: `tasks.md` is the only valid ledger of completed work.
- **Logic Rules**: `requirements.md` contains the only valid business logic.
- **Verification**: `design.md` defines the 32 "Correctness Properties" that must be verified via testing.