# Contract Crown — Architecture Graph

## High-Level System Architecture

```mermaid
graph TB
    subgraph CLIENT["🖥️ Client (Browser PWA)"]
        APP["app.ts<br/>Entry Point"]
        UI["UI Module<br/>src/ui/"]
        SESSION["Session Module<br/>src/session/"]
    end

    subgraph SERVER["☁️ Server (PartyKit)"]
        PARTY["party/<br/>main.ts + server.ts"]
        SRV["Server Module<br/>src/server/"]
    end

    subgraph SHARED["🔧 Shared Logic"]
        ENGINE["Engine Module<br/>src/engine/"]
        BOT["Bot Module<br/>src/bot/"]
    end

    subgraph EXTERNAL["📦 External Services"]
        SUPA["Supabase<br/>(Auth + DB)"]
        PK["PartyKit<br/>(WebSocket Infra)"]
    end

    APP --> UI
    APP --> SESSION
    UI -->|imports types & rules| ENGINE
    UI -->|PartySocket| PK
    PARTY -->|game logic| ENGINE
    PARTY -->|AI players| BOT
    PARTY -->|persistence| SUPA
    SRV -->|game logic| ENGINE
    SRV -->|AI players| BOT
    SRV -->|persistence| SUPA
    BOT -->|card rules| ENGINE
    SESSION -->|auth tokens| SUPA

    style CLIENT fill:#1a1a2e,stroke:#e94560,color:#fff
    style SERVER fill:#16213e,stroke:#0f3460,color:#fff
    style SHARED fill:#0f3460,stroke:#533483,color:#fff
    style EXTERNAL fill:#533483,stroke:#e94560,color:#fff
```

---

## Module Dependency Graph

```mermaid
graph LR
    ENGINE["engine/"]
    BOT["bot/"]
    UI["ui/"]
    SESSION["session/"]
    SERVER["server/"]
    PARTY["party/"]

    UI -->|types, canPlayCard| ENGINE
    UI -->|BotManager| BOT
    UI -->|SessionManager| SESSION
    BOT -->|types, canPlayCard| ENGINE
    SERVER -->|types, game fns| ENGINE
    SERVER -->|BotManager| BOT
    PARTY -->|types, game fns| ENGINE
    PARTY -->|BotManager| BOT

    style ENGINE fill:#2d6a4f,stroke:#95d5b2,color:#fff
    style BOT fill:#774936,stroke:#ddb892,color:#fff
    style UI fill:#e63946,stroke:#f1faee,color:#fff
    style SESSION fill:#457b9d,stroke:#a8dadc,color:#fff
    style SERVER fill:#264653,stroke:#2a9d8f,color:#fff
    style PARTY fill:#6d6875,stroke:#b5838d,color:#fff
```

---

## Engine Module (`src/engine/`)

| File | Exports | Purpose |
|---|---|---|
| [types.ts](file:///Users/atifkhan/development/contract-krown/src/engine/types.ts) | `Card, Suit, Rank, Player, Trick, GameState, GamePhase` | Core domain types |
| [game-engine.ts](file:///Users/atifkhan/development/contract-krown/src/engine/game-engine.ts) | 22 pure functions (`createDeck`, `shuffle`, `playCard`, `canPlayCard`, `resolveTrick`, etc.) | Stateless game rules |

> [!NOTE]
> Engine has **zero** external dependencies — pure TypeScript logic only. All game state mutations happen through exported functions.

---

## Bot Module (`src/bot/`)

```mermaid
graph TD
    BM["BotManager<br/>Orchestrator"]
    SB["SmartBot<br/>AI Decision Logic"]
    TM["TeamMemory<br/>Card Tracking"]
    CP["CardProbability<br/>Statistical Analysis"]

    BM --> SB
    BM --> TM
    SB --> TM
    CP -.->|standalone utility| TM

    BM -->|imports| ENGINE_TYPES["engine/types"]
    BM -->|imports| ENGINE_FNS["engine/canPlayCard"]
    SB -->|imports| ENGINE_TYPES
    TM -->|imports| ENGINE_TYPES
    CP -->|imports| ENGINE_TYPES

    style BM fill:#774936,stroke:#ddb892,color:#fff
    style SB fill:#774936,stroke:#ddb892,color:#fff
    style TM fill:#774936,stroke:#ddb892,color:#fff
    style CP fill:#774936,stroke:#ddb892,color:#fff
```

---

## UI Module (`src/ui/`) — Component Tree

```mermaid
graph TD
    APP["app.ts<br/>🏠 Entry + Router"]

    subgraph VIEWS["Views (Pages)"]
        LOGIN["LoginView"]
        REG["RegistrationView"]
        FORGOT["ForgotPasswordView"]
        RESET["ResetPasswordView"]
        LOBBY["LobbyView"]
        OGV["OfflineGameView"]
        WRV["WaitingRoomView"]
    end

    subgraph CONTROLLERS["Game Controllers"]
        OGC["OfflineGameController"]
        ONC["OnlineGameController"]
    end

    subgraph GAME_UI["Game Rendering"]
        GV["GameView"]
        FG["FeltGrid<br/>🎴 Card Table"]
        GH["GameHeader"]
        GM["GameMenu"]
        CM["ContextMenu"]
    end

    subgraph MODALS["Modal System"]
        MBS["ModalBottomSheet<br/>Base Class"]
        TS["TrumpSelector"]
        REM["RoundEndModal"]
        VM["VictoryModal"]
        JRM["JoinRoomModal"]
    end

    subgraph INFRA["Infrastructure"]
        RTR["Router"]
        TM["ThemeManager"]
        HC["HapticController"]
        CA["CardAnimation"]
        PKW["PartyKitClientWrapper"]
        RO["ReconnectionOverlay"]
        AH["AppHeader"]
    end

    APP --> LOGIN & REG & FORGOT & RESET & LOBBY & OGV & WRV
    APP --> ONC & RTR & TM & JRM & AH

    OGV --> OGC & GV
    OGC --> GV & HC
    ONC --> GV & HC & PKW

    GV --> FG & TS & REM & VM & GM & CM & TM & HC & CA
    TS & REM & VM & JRM & CM --> MBS

    LOGIN --> RTR
    LOBBY --> RTR & TM
    REG --> RTR
    RO --> RTR
    AH --> HC
    WRV --> HC

    style APP fill:#e63946,stroke:#f1faee,color:#fff
    style VIEWS fill:#1d3557,stroke:#457b9d,color:#fff
    style CONTROLLERS fill:#264653,stroke:#2a9d8f,color:#fff
    style GAME_UI fill:#6a040f,stroke:#dc2f02,color:#fff
    style MODALS fill:#7b2cbf,stroke:#c77dff,color:#fff
    style INFRA fill:#495057,stroke:#adb5bd,color:#fff
```

---

## Server Module (`src/server/`)

```mermaid
graph TD
    PS["party-server.ts<br/>HTTP API Worker"]
    CR["CrownRoom<br/>WebSocket Game Room"]
    RR["RoomRegistry<br/>Room Lookup"]
    RCG["RoomCodeGenerator"]
    SUP["supabase.ts<br/>DB Client"]
    AUTH["AuthManager"]
    UM["UserManager"]
    GM["GameManager"]

    PS --> RR & SUP
    CR --> RR & RCG & ENGINE["engine/*"] & BOT["BotManager"]

    style PS fill:#264653,stroke:#2a9d8f,color:#fff
    style CR fill:#264653,stroke:#2a9d8f,color:#fff
    style SUP fill:#533483,stroke:#e94560,color:#fff
```

---

## PartyKit Deployment Layer (`party/`)

| File | Role |
|---|---|
| [main.ts](file:///Users/atifkhan/development/contract-krown/party/main.ts) | HTTP API server (auth, rooms, leaderboard) — imports `engine`, `bot`, `supabase` |
| [server.ts](file:///Users/atifkhan/development/contract-krown/party/server.ts) | WebSocket game room server — imports `engine`, `bot`, `supabase` |

> [!IMPORTANT]
> `party/` files are **self-contained duplicates** of `src/server/` logic, deployed directly to PartyKit. They import from `../src/engine/` and `../src/bot/` but NOT from `src/server/`.

---

## CSS Architecture (`src/ui/styles/`)

```mermaid
graph LR
    MAIN["main.css<br/>@import orchestrator"] --> T["01-theme-tokens.css<br/>CSS variables & palette"]
    MAIN --> BL["02-base-layout.css<br/>App shell"]
    MAIN --> FG["03-felt-grid.css<br/>Card table layout"]
    MAIN --> CA["04-cards-animations.css<br/>Card visuals + keyframes"]
    MAIN --> CM["05-components-modals.css<br/>Modals & overlays"]
    MAIN --> CF["06-components-forms.css<br/>Auth forms & inputs"]
    MAIN --> VG["07-views-game.css<br/>Game view styling"]
    MAIN --> VO["08-views-online.css<br/>Lobby, waiting room"]
    MAIN --> RS["09-responsive.css<br/>Media queries"]

    style MAIN fill:#e63946,stroke:#f1faee,color:#fff
```

> Built with **PostCSS** + **Tailwind CSS 3** + **DaisyUI 4**. Processed via `postcss-import` → single `styles.css` bundle.

---

## Test Structure (`tests/`)

| Directory | Coverage |
|---|---|
| `tests/property/` | fast-check property tests (TDD requirement) |
| `tests/engine/` | Game engine unit tests |
| `tests/bot/` | Bot AI logic tests |
| `tests/server/` | Server-side tests |
| `tests/session/` | Session manager tests |
| `tests/ui/` | UI component tests |
| `tests/client/` | Client integration tests |
| `tests/integration/` | Cross-module integration |
| `tests/e2e/` | Playwright end-to-end tests |

---

## External Dependencies

| Dependency | Layer | Purpose |
|---|---|---|
| `partykit` / `partysocket` | Server / Client | WebSocket multiplayer infrastructure |
| `@supabase/supabase-js` | Server + Session | Auth, user profiles, game persistence |
| `page` | Client | Client-side SPA routing |
| `ios-haptics` | Client | Touch feedback on iOS |
| `tailwindcss` + `daisyui` | Client CSS | Utility-first styling + component library |
| `fast-check` | Tests | Property-based testing |
| `playwright` | Tests | E2E browser testing |
| `vitest` / `bun test` | Tests | Unit test runner |

---

## Data Flow — Online Game

```mermaid
sequenceDiagram
    participant B as Browser (UI)
    participant PS as PartySocket
    participant PK as PartyKit Server
    participant E as Game Engine
    participant Bot as BotManager
    participant DB as Supabase

    B->>PS: connect(roomId)
    PS->>PK: WebSocket handshake
    PK->>DB: verify auth token
    PK-->>B: connection accepted

    B->>PK: {type: "play_card", card}
    PK->>E: canPlayCard() → playCard()
    E-->>PK: updated GameState
    PK->>Bot: getBotMove() (if bot turn)
    Bot->>E: evaluate hand
    Bot-->>PK: selected card
    PK-->>B: broadcast state update
    PK->>DB: persist game result (on GAME_END)
```
