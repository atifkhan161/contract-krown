# PRD: Contract Crown (Mobile-Only PWA / Render Edition)

**Project Goal:** A high-performance, real-time 4-player trick-taking game. Built as a Mobile-Only Progressive Web App (PWA) for a native app-like experience with zero-budget infrastructure.

---

## 1. Detailed Game Rules

### 1.1 Objective
Two fixed partnerships (Team 1: Players 0 & 2 | Team 2: Players 1 & 3) compete to be the first to reach a target score of **52 points**.

### 1.2 The Deck & Dealing
* **The Deck:** 32 cards (Ranks 7, 8, 9, 10, J, Q, K, A in all four suits).
* **Initial Phase:** Each player receives **4 cards**.
* **Trump Declaration:** The current "Crown" holder (or the player left of the dealer) declares the Trump suit based on their first 4 cards.
* **Secondary Phase:** The remaining **4 cards** are dealt (8 cards total per player).

### 1.3 The Crown Rule (Declaration Privilege)
* **Retention:** If the Declaring Team wins **5 or more tricks**, the declarer keeps the "Crown" and declares again in the next round.
* **Rotation:** If the Declaring Team wins **fewer than 5 tricks**, the "Crown" passes clockwise to the next player.
* **Dealer:** The dealer role always rotates clockwise every round, regardless of the Crown status.

### 1.4 Winner-Takes-All Scoring
Only the winning team of a round receives points. If the contract is failed, the challenging team takes all points.
- **If Declaring Team wins T tricks (where T >= 5):** They get T points.
- **If Declaring Team wins < 5 tricks:** The Challenging Team gets T points (where T is the number of tricks the challengers won, typically >= 4).
- **Otherwise:** 0 points for that round.

---

## 2. Technical Stack & Specifications

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Runtime** | **Bun** | Ultra-fast execution and native TypeScript support. |
| **Game Server** | **Colyseus** | Authoritative state-sync for real-time multiplayer. |
| **Backend Framework**| **ElysiaJS** | High-performance API routing for Bun. |
| **Database** | **LokiJS** | In-memory document DB with JSON file persistence. |
| **Routing** | **Page.js** | Client-side SPA routing (Login, Lobby, Table). |
| **UI Framework** | **Tailwind + DaisyUI** | Mobile-first utility classes and luxury themes. |
| **PWA** | **Service Workers** | Offline caching and "Add to Home Screen" support. |
| **Deployment** | **Render (Free)** | Docker-based hosting (Ephemeral file system). |

---

## 3. Mobile-Only UX & PWA Specifications

### 3.1 Portrait-First Layout
* **Thumb-Zone Navigation:** All primary actions (Playing cards, declaring trump) are anchored at the bottom 30% of the screen.
* **The "Felt" Grid:** * **Top:** Partner avatar and card count.
    * **Left/Right:** Opponent avatars.
    * **Bottom:** User's interactive hand.
    * **Center:** Active trick area.
* **Header:** Minimalist HUD showing Trump suit, current "Crown" holder, and team scores.

### 3.2 PWA & Haptics
* **Standalone Mode:** Uses `manifest.json` to remove browser UI for a full-screen experience.
* **Haptic Feedback:** Short vibrations (Vibration API) triggered on:
    * Your turn to play.
    * Winning a trick.
    * Trump declaration.
* **Offline Ready:** Service workers cache the core UI and card assets for instant loading.

---

## 4. Implementation Phases

### Phase 1: Core Engine & TDD
* Implement `GameEngine.ts` (Shuffling, Ranking, Trick-winner logic).
* Run `bun test` to verify the "Winner-Takes-All" scoring and "Crown Rule" logic.

### Phase 2: PWA Shell & Mobile UI
* Setup **Page.js** routing for `/login`, `/lobby`, and `/game`.
* Build the vertical mobile layout with **Tailwind CSS**.
* Implement **manifest.json** and Service Worker registration.

### Phase 3: Offline Gameplay (Bot Practice)
* **CRITICAL STEP:** Develop a local `BotManager` allowing a single user to play against 3 AI bots locally in the browser.
* Perfect the card animations (flicks, flight paths) and mobile touch interactions without server latency.

### Phase 4: Online Backend (Networking)
* Initialize **Colyseus** `CrownRoom`.
* Migrate the Offline logic to a Server-Authoritative state.
* Implement "Shadow Testing" using a headless Bun script to simulate 3 players.

### Phase 5: Persistence & Auth
* Implement **LokiJS** for user management.
* Session management via `localStorage` to keep users logged in on their mobile devices.

---

## 5. UI/UX Feedback System
* **Turn Indicator:** A pulsing ring around the active player's avatar.
* **Playability Ghosting:** Cards that cannot be played (following suit rules) are dimmed and unclickable.
* **Trump Reveal:** A center-screen suit overlay animation when trump is declared.
* **Victory Vibe:** Device vibration and "luxury" themed DaisyUI modals on round/game completion.

---

## 6. Developer Testing (Solo Workflow)
* **Offline Mode:** Test the `BotManager` logic directly in the mobile browser view.
* **Headless Test:** Run `bun run test-players.ts` to simulate 3 bots joining the Render server.
* **Mobile Simulation:** Use Chrome DevTools "Responsive" mode set to iPhone/Pixel dimensions.