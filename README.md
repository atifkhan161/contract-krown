# Contract Crown

A mobile-first Progressive Web App (PWA) implementing a real-time 4-player trick-taking card game with zero-budget infrastructure.

<p align="center">
  <img src="https://img.shields.io/badge/Bun-%23000?logo=bun" alt="Bun">
  <img src="https://img.shields.io/badge/TypeScript-%2300?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Colyseus-multiplayer-blue" alt="Colyseus">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## The Game

Contract Crown is a trick-taking card game where two partnerships compete to reach **52 points** first.

### Rules Overview

**The Deck**
- 32 cards: Ranks 7, 8, 9, 10, J, Q, K, A in all four suits
- Each player receives 8 cards total (4 + 4 deal)

**The Crown Rule**
- The Crown holder declares the trump suit after receiving their first 4 cards
- If the declaring team wins **5 or more tricks**, they keep the Crown for the next round
- If they win **fewer than 5 tricks**, the Crown passes clockwise to the next player
- The dealer role always rotates clockwise every round

**Scoring**
- Winner-takes-all system: only the winning team receives points
- If declaring team wins T tricks (T >= 5): they get T points
- If declaring team wins < 5 tricks: challenging team gets T points (T = tricks challengers won)

**Victory**
- First team to reach 52 points wins the game

---

## Technical Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| Runtime | Bun | Ultra-fast execution and native TypeScript support |
| Game Server | Colyseus | Authoritative state-sync for real-time multiplayer |
| Backend | ElysiaJS | High-performance API routing for Bun |
| Database | LokiJS | In-memory document DB with JSON file persistence |
| Routing | Page.js | Client-side SPA routing |
| UI Framework | Tailwind + DaisyUI | Mobile-first utility classes and luxury themes |
| PWA | Service Workers | Offline caching and standalone mode |
| Testing | Vitest + Fast-Check | Property-based testing for game logic |

---

## Features

### Gameplay
- **Offline Mode**: Practice against 3 AI bots with smart team-shared memory
- **Online Multiplayer**: Real-time play with room codes (up to 4 players)
- **Smart AI Bots**: Card tracking, partner coordination, trump conservation, endgame play

### Mobile Experience
- **Portrait-First Layout**: Thumb-zone optimized with "Felt Grid" design
- **PWA Ready**: Install to home screen, standalone mode, offline caching
- **Haptic Feedback**: Device vibrations for turns, tricks, and victories
- **60 FPS Animations**: Smooth card plays and transitions

### Game Interface
- **Playability Indicators**: Dimmed cards you cannot legally play
- **Turn Indicators**: Pulsing ring around active player
- **Trump Reveal Animation**: Center-screen suit overlay when trump declared
- **Played Cards Viewer**: Review tricks your team has won

---

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) (v1.1+)

### Installation

```bash
# Clone the repository
git clone https://github.com/anomalyco/contract-krown.git
cd contract-krown

# Install dependencies
bun install
```

### Development

```bash
# Start development server (CSS + JS + Server with watch mode)
bun run dev
```

The app will be available at `http://localhost:3000`

### Production Build

```bash
# Build for production
bun run build

# Start production server
bun run start
```

### Testing

```bash
# Run all tests
bun test

# Run tests with coverage
bun test --coverage

# Run E2E tests (requires build first)
bun run build && bun run test:e2e

# Run offline bot mode test
bun run test:e2e:solo
```

---

## Project Structure

```
contract-krown/
├── public/
│   ├── index.html          # Main HTML entry point
│   └── manifest.json      # PWA manifest
├── src/
│   ├── bot/                # AI bot logic
│   │   ├── bot-logic.ts    # Card selection strategies
│   │   ├── bot-manager.ts # Bot instance management
│   │   └── team-memory.ts # Team-shared card tracking
│   ├── engine/             # Core game logic
│   │   ├── game-engine.ts # Shuffling, ranking, trick resolution
│   │   └── types.ts        # TypeScript interfaces
│   ├── server/             # Colyseus server
│   │   ├── crown-room-state.ts  # Game room state schema
│   │   ├── rooms.ts        # Room management
│   │   └── index.ts        # Server entry point
│   ├── session/            # User authentication
│   │   └── session-manager.ts
│   └── ui/                 # Frontend components
│       ├── components.ts   # Reusable UI components
│       ├── felt-grid.ts    # Player position layout
│       ├── game-view.ts    # Main game screen
│       └── styles/         # CSS stylesheets
├── tests/
│   ├── bot/                # Bot logic tests
│   ├── e2e/                # End-to-end tests
│   ├── engine/             # Game engine tests
│   ├── integration/        # Server integration tests
│   ├── property/           # Fast-check property tests
│   └── ui/                 # UI component tests
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vitest.config.ts
```

---

## Architecture

### The Felt Grid Layout

```
     [Partner]
        ^
   +-----------+
   |           |
[Left]  [Trick]  [Right]
   |           |
   +-----------+
        v
     [You]
```

- **Top**: Partner avatar and card count
- **Left/Right**: Opponent avatars
- **Bottom**: Your interactive hand
- **Center**: Active trick area

The layout automatically maps server player indices to your client view position.

### Game State Flow

1. **Lobby**: Create or join a room with a 4-character code
2. **Waiting Room**: See players, shuffle teams, add bots, or start game
3. **Trump Declaration**: Crown holder selects trump suit
4. **Trick Play**: Play cards following suit-taking rules
5. **Round End**: Award points, check for 52+ score
6. **Victory**: Declare winner, return to lobby or play again

---

## Deployment

### Render (Free Tier)

```bash
# Build the app
bun run build

# Deploy to Render
# The server uses Bun runtime with Colyseus WebSocket support
```

The app is designed to run on Render's free tier with ephemeral filesystem. LokiJS persists data periodically to handle container restarts.

---

## Development Standards

### Code Quality
- **TypeScript**: Strict mode with full type coverage
- **TDD**: Property-based tests via Fast-Check before implementation
- **Separation of Concerns**: Separate HTML/CSS/TS files for features

### Testing Strategy
- **Unit Tests**: Game engine logic via Vitest
- **Property Tests**: Fast-check for game rule invariants
- **E2E Tests**: Playwright for full gameplay scenarios

### UI Standards
- Tailwind CSS utilities first
- DaisyUI components for common patterns
- CSS custom properties for theming
- 60 FPS animations via CSS transforms

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Tech Credits

Built with:
- [Bun](https://bun.sh) - The fast JavaScript runtime
- [Colyseus](https://colyseus.io/) - Real-time multiplayer framework
- [Elysia](https://elysiajs.com/) - Fast web framework for Bun
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [DaisyUI](https://daisyui.com/) - Component library for Tailwind
- [Vitest](https://vitest.dev/) - Next generation testing framework
