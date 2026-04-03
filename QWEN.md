# Contract Crown - Project Context

## Project Overview

**Contract Crown** is a mobile-first Progressive Web App (PWA) for a 4-player trick-taking card game. It features both offline bot practice and online multiplayer modes, built with a zero-budget infrastructure philosophy.

### Core Game Rules
- **Deck**: 32 cards (ranks 7, 8, 9, 10, J, Q, K, A in four suits)
- **Players**: 4 players in fixed partnerships (Team 0: Players 0 & 2 | Team 1: Players 1 & 3)
- **Objective**: First team to reach **52 points** wins
- **Deal**: 8 cards per player (two phases of 4 cards)
- **Trump**: Declared by the "Crown" holder after receiving first 4 cards
- **Scoring**: Winner-takes-all — declaring team needs ≥5 tricks to score; otherwise challengers score
- **Crown Rule**: Crown retained if declaring team wins ≥5 tricks, otherwise passes clockwise

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | **Bun** |
| Game Server | **Colyseus** (authoritative state-sync) |
| Backend Framework | **ElysiaJS** |
| Database | **LokiJS** (in-memory with JSON persistence) |
| Client Routing | **Page.js** |
| UI | **Tailwind CSS + DaisyUI** |
| Testing | **Vitest + fast-check** (property-based) |
| Build | **Bun build** (no bundler) |

## Project Structure

```
contract-krown/
├── src/
│   ├── engine/          # Core game logic (deck, shuffle, tricks, scoring, crown rules)
│   │   ├── game-engine.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── bot/             # AI bot logic (BotManager, SmartBot strategies)
│   ├── server/          # Colyseus rooms, Elysia API, auth, database
│   │   ├── serve.ts     # Main server entry
│   │   ├── api.ts       # REST endpoints
│   │   ├── auth.ts      # Authentication
│   │   ├── database.ts  # LokiJS setup
│   │   ├── rooms.ts     # Colyseus room definitions
│   │   └── users.ts     # User management
│   ├── session/         # Session management (localStorage, tokens)
│   └── ui/              # Frontend components (PWA shell, views, controllers)
│       ├── app.ts       # App entry point
│       ├── router.ts    # Page.js routing
│       ├── felt-grid.ts # Mobile layout component
│       ├── game-view.ts # Main game view
│       ├── offline-game-controller.ts  # Offline bot-driven game loop
│       ├── online-game-controller.ts   # Online multiplayer controller
│       ├── colyseus-client-wrapper.ts  # Colyseus client integration
│       ├── components.ts               # Reusable UI components
│       ├── modals/                     # Modal components
│       └── styles/                     # CSS stylesheets
├── tests/
│   ├── property/        # fast-check property tests (TDD requirement)
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   ├── engine/          # Engine-specific tests
│   ├── bot/             # Bot tests
│   ├── ui/              # UI tests
│   ├── server/          # Server tests
│   └── setup.js         # Test setup
├── public/
│   ├── index.html       # PWA shell
│   └── manifest.json    # PWA manifest
├── scripts/             # Build and utility scripts
├── .kiro/specs/         # Kiro IDE specifications and tasks
│   └── contract-crown-game/tasks.md  # Implementation task tracker
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── postcss.config.js
├── contract_final_prd.md  # Product Requirements Document
├── ai_training_guide.md   # AI model training pipeline docs
└── AGENTS.md             # Kiro IDE agent working agreements
```

## Building and Running

### Development
```bash
# Install dependencies
bun install

# Start development server (CSS watcher, JS bundler, server watcher)
bun run dev
# Opens on http://localhost:3000
```

### Build
```bash
# Full build (server + client)
bun run build

# Build server only
bun run build:server

# Build client (JS + CSS + copy public assets)
bun run build:client
```

### Production
```bash
# Start production server
bun run start
```

### Testing
```bash
# Run all tests
bun test

# Run tests in watch mode
bun run test:watch

# Run with coverage
bun run test:coverage

# Run unit tests only
bun run test:unit
```

### Linting
```bash
# Type check + ESLint
bun run lint
```

## Development Conventions

### Mandatory Workflow (Kiro IDE)
1. **Read `tasks.md`** first to identify current task and linked requirements
2. **Source of Truth**: Business logic → `requirements.md`, Interfaces → `design.md`
3. **TDD Requirement**: Write a `fast-check` property test in `tests/property/` BEFORE implementing any logic
4. **Completion**: Only mark tasks as `[x]` in `tasks.md` after `bun test` passes with 100% coverage

### Coding Standards
- **Separation of Concerns**: Separate `.html` / `.css` / `.ts` files — never mix concerns
- **No Inline HTML Templates**: All markup in dedicated `.html` files or structured DOM classes
- **No Inline Styles**: Use CSS classes, never `element.style.xxx = '...'`
- **TypeScript Strict Mode**: `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- **Path Aliases**: Use `@src/*` and `@tests/*` for imports

### CSS & Theming
- **Tailwind CSS First**: Use utility classes for layout, spacing, typography
- **DaisyUI Components**: Prefer DaisyUI for common patterns (btn, modal, card, alert, etc.)
- **CSS Custom Properties**: Define theme variables in stylesheets (`var(--app-primary)`, etc.)
- **Naming**: BEM-style or kebab-case for custom classes
- **No Magic Numbers**: Use CSS classes for layout/positioning in JS/TS

### Mobile-First Design
- **Portrait-Only Layout**: "Felt Grid" 3x3 CSS Grid layout
- **Thumb-Zone**: Primary actions in bottom 30% of viewport
- **Touch Targets**: Minimum 44x44px
- **Safe Area Insets**: Use `env(safe-area-inset-*)` for iOS notches
- **Haptic Feedback**: Vibration API for turn prompts, trick wins, errors

### Animation Performance
- **60 FPS Target**: Use `transform` and `opacity` only — never `top/left/width/height`
- **GPU Acceleration**: Use `will-change: transform` sparingly
- **CSS Transitions**: Prefer over JavaScript timers

### Testing Practices
- **Property-Based Testing**: Use `fast-check` for game logic invariants
- **Class-Based Components**: TypeScript classes with `destroy()` lifecycle methods
- **Event Delegation**: Attach listeners to parents, not individual elements
- **Memory Cleanup**: Always implement `destroy()` to prevent leaks

## Key Architectural Concepts

### Game Engine (`src/engine/`)
Pure game logic with no DOM/network dependencies. Functions include:
- `createDeck()`, `shuffle()`, `dealInitial()`, `dealFinal()`
- `declareTrump()`, `playCard()`, `canPlayCard()`, `resolveTrick()`
- `calculateScore()`, `updateCrown()`, `rotateDeal()`, `startNewRound()`
- `isGameComplete()`, `countTricksByTeam()`, `validateDeal()`

### Offline Mode (`src/ui/offline-game-controller.ts`)
Drives a complete game loop in the browser with 3 AI bots. Used for local testing and single-player experience.

### Online Mode (`src/ui/online-game-controller.ts` + `src/server/`)
Server-authoritative multiplayer using Colyseus rooms. Client syncs with server state via `CrownRoomState`.

### UI Architecture
- **Views**: `GameView`, `LobbyView`, `LoginView`, `RegistrationView`
- **Controllers**: `OfflineGameController`, `OnlineGameController`
- **Components**: `FeltGrid`, `GameHeader`, `TrumpSelector`, `ModalBottomSheet`, etc.
- **Router**: Page.js handles `/login`, `/lobby`, `/game/:roomId`, `/offline`

## PWA Features
- **Standalone Mode**: Full-screen experience via `manifest.json`
- **Service Workers**: Offline caching (planned)
- **Haptics**: `HapticController` wraps Vibration API
- **Animations**: CSS `transform`-based for card plays, trick collections, victory effects

## Current Status
- ✅ Core game engine (deck, shuffle, tricks, scoring, crown rules)
- ✅ Bot Manager with AI opponents
- ✅ PWA Shell with routing and authentication
- ✅ Mobile Felt Grid UI (3x3 layout)
- ✅ Offline game mode (fully playable vs 3 bots)
- ✅ Card animation system and haptics
- ✅ Login, Registration, Lobby views
- ✅ Session management with LokiJS persistence
- ✅ Game Menu with Played Cards Viewer
- ⏳ Online multiplayer (Colyseus rooms — partially implemented)
- ⏳ Property tests for GameMenu (task 33.8 pending)

## Important Files
- `AGENTS.md` — Working agreements for Kiro IDE agents
- `.kiro/specs/contract-crown-game/tasks.md` — Task tracker with requirements links
- `contract_final_prd.md` — Product Requirements Document
- `ai_training_guide.md` — AI model training pipeline documentation
- `src/engine/game-engine.ts` — Core game logic (single source of truth for rules)
- `src/engine/types.ts` — All type definitions for game state
