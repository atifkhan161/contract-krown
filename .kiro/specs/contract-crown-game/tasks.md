# Implementation Plan: Contract Crown Game

## Overview

This plan implements a mobile-first Progressive Web App for a 4-player trick-taking card game with both offline bot practice and online multiplayer modes. The implementation follows a phased approach optimized for early offline testing: Core Engine with TDD → PWA Shell & Mobile UI → Offline Gameplay with Bots → Online Backend with Colyseus → Persistence & Auth.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Create project directory with TypeScript configuration
  - Install dependencies: Bun, Colyseus, ElysiaJS, LokiJS, Page.js, Tailwind, DaisyUI, fast-check
  - Set up testing framework with fast-check for property-based testing
  - Create directory structure: src/engine, src/bot, src/ui, src/server, src/session, tests/
  - _Requirements: 18.4, 20.4_

- [x] 2. Implement core game engine with deck management
  - [x] 2.1 Create Card and Deck types and interfaces
    - Define Card, Suit, Rank, Player, GameState, Trick, PlayedCard interfaces
    - Implement createDeck() function to generate 32-card deck
    - _Requirements: 1.1_
  
  - [ ]* 2.2 Write property test for deck composition
    - **Property 1: Deck Composition**
    - **Validates: Requirements 1.1**
  
  - [x] 2.3 Implement cryptographically secure shuffle function
    - Use Web Crypto API for secure random shuffling
    - _Requirements: 1.2_
  
  - [ ]* 2.4 Write property test for shuffle preservation
    - **Property 2: Shuffle Preservation**
    - **Validates: Requirements 1.2**
  
  - [x] 2.5 Implement initial dealing phase (4 cards per player)
    - Create dealInitial() function
    - _Requirements: 1.3_
  
  - [ ]* 2.6 Write property test for initial deal distribution
    - **Property 3: Initial Deal Distribution**
    - **Validates: Requirements 1.3**
  
  - [x] 2.7 Implement final dealing phase (4 more cards per player)
    - Create dealFinal() function
    - _Requirements: 1.4, 1.5_
  
  - [ ]* 2.8 Write property test for final deal distribution
    - **Property 4: Final Deal Distribution**
    - **Validates: Requirements 1.4, 1.5**
  
  - [x] 2.9 Implement re-deal validation for extreme hands
    - Create validateDeal() function to check for 3+ Aces or 3+ Sevens
    - Create checkForExtremeHand() helper function
    - Implement re-deal loop until valid deal achieved
    - _Requirements: 1.6, 21.1, 21.2, 21.3, 21.4, 21.5_
  
  - [ ]* 2.10 Write property test for re-deal on extreme hand condition
    - **Property 4.1: Re-Deal on Extreme Hand Condition**
    - **Validates: Requirements 1.6, 21.1, 21.2, 21.3, 21.4, 21.5**

- [x] 3. Implement trump declaration system
  - [x] 3.1 Implement crown holder identification logic
    - Track crown holder in game state
    - Initialize crown holder at game start
    - _Requirements: 2.1_
  
  - [x] 3.2 Write property test for crown holder identification
    - **Property 5: Crown Holder Identification**
    - **Validates: Requirements 2.1**
  
  - [x] 3.3 Implement declareTrump() function
    - Validate crown holder can declare trump
    - Update game state with selected trump suit
    - _Requirements: 2.3_
  
  - [x] 3.4 Write property test for trump declaration
    - **Property 6: Trump Declaration**
    - **Validates: Requirements 2.3**

- [x] 4. Implement trick-taking core logic
  - [x] 4.1 Implement first trick leader determination
    - Calculate (dealer + 1) % 4 as first lead player
    - _Requirements: 3.1_
  
  - [x] 4.2 Write property test for first trick leader
    - **Property 7: First Trick Leader**
    - **Validates: Requirements 3.1**
  
  - [x] 4.3 Implement turn order progression
    - Advance current player clockwise after each card play
    - _Requirements: 3.2_
  
  - [x] 4.4 Write property test for turn order progression
    - **Property 8: Turn Order Progression**
    - **Validates: Requirements 3.2**
  
  - [x] 4.5 Implement canPlayCard() validation function
    - Check if player is leading (all cards playable)
    - Check suit-following requirements when following
    - Check if player has no cards of led suit (all cards playable)
    - _Requirements: 3.3, 3.4, 3.5_
  
  - [x] 4.6 Write property tests for card playability rules
    - **Property 9: Lead Player Freedom**
    - **Property 10: Suit Following Requirement**
    - **Property 11: No Suit Following Freedom**
    - **Validates: Requirements 3.3, 3.4, 3.5, 8.4**
  
  - [x] 4.7 Implement playCard() function
    - Validate card can be played
    - Remove card from player hand
    - Add card to current trick
    - Advance turn
    - _Requirements: 3.2_
  
  - [x] 4.8 Implement resolveTrick() function
    - Determine highest trump card if any trump played
    - Otherwise determine highest card of led suit
    - Return winner player index
    - _Requirements: 3.6, 3.7_
  
  - [x] 4.9 Write property test for trick resolution
    - **Property 12: Trick Resolution Correctness**
    - **Validates: Requirements 3.6, 3.7**
  
  - [x] 4.10 Implement trick winner leads next logic
    - Set next trick's lead player to previous trick winner
    - _Requirements: 3.8_
  
  - [x] 4.11 Write property test for trick winner leads next
    - **Property 13: Trick Winner Leads Next**
    - **Validates: Requirements 3.8**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Crown Rule and scoring system
  - [x] 6.1 Implement crown retention logic
    - Check if declaring team won >= 5 tricks
    - Retain crown holder if condition met
    - _Requirements: 4.1_
  
  - [x] 6.2 Write property test for crown retention
    - **Property 14: Crown Retention on Success**
    - **Validates: Requirements 4.1**
  
  - [x] 6.3 Implement crown rotation logic
    - Pass crown clockwise if declaring team won < 5 tricks
    - Calculate (currentCrownHolder + 1) % 4
    - _Requirements: 4.2_
  
  - [x] 6.4 Write property test for crown rotation
    - **Property 15: Crown Rotation on Failure**
    - **Validates: Requirements 4.2**
  
  - [x] 6.5 Implement dealer rotation logic
    - Rotate dealer clockwise every round
    - Calculate (currentDealer + 1) % 4
    - _Requirements: 4.3_
  
  - [x] 6.6 Write property test for dealer rotation
    - **Property 16: Dealer Rotation**
    - **Validates: Requirements 4.3**
  
  - [x] 6.7 Implement winner-takes-all scoring
    - Award T points to declaring team if T >= 5
    - Award challenging team's trick count if declaring team < 5
    - _Requirements: 5.1, 5.2_
  
  - [x] 6.8 Write property tests for scoring rules
    - **Property 17: Declaring Team Success Scoring**
    - **Property 18: Challenging Team Success Scoring**
    - **Validates: Requirements 5.1, 5.2**
  
  - [x] 6.9 Implement score accumulation
    - Maintain cumulative scores across rounds
    - _Requirements: 5.3_
  
  - [x] 6.10 Write property test for score accumulation
    - **Property 19: Score Accumulation**
    - **Validates: Requirements 5.3**
  
  - [x] 6.11 Implement game completion detection
    - Check if either team >= 52 points
    - Transition to GAME_END phase
    - _Requirements: 5.4_
  
  - [x] 6.12 Write property test for game completion
    - **Property 20: Game Completion**
    - **Validates: Requirements 5.4**

- [x] 7. Implement Bot Manager for AI opponents
  - [x] 7.1 Create BotManager class with strategy logic
    - Implement selectTrumpSuit() - choose suit with most cards
    - Implement selectCard() with basic strategy
    - Add timing delays (500-1500ms) for human-like behavior
    - _Requirements: 10.1, 10.2, 10.5_
  
  - [x] 7.2 Write property test for bot legal move selection
    - **Property 25: Bot Legal Move Selection**
    - **Validates: Requirements 10.2, 10.3**
  
  - [x] 7.3 Write unit tests for bot strategy
    - Test trump selection logic
    - Test card selection in various scenarios
    - Test timing delays are within range
    - _Requirements: 10.2, 10.5_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement PWA Shell and routing
  - [x] 9.1 Create manifest.json for PWA
    - Define app name, icons, display mode (standalone)
    - Configure theme colors and orientation
    - _Requirements: 6.1, 6.2_
  
  - [x] 9.2 Implement Page.js routing
    - Set up routes: /login, /lobby, /game/:roomId, /offline
    - Implement route handlers
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [x] 9.3 Implement authentication guard middleware
    - Check session on protected routes
    - Redirect to /login if not authenticated
    - Allow /offline route without authentication
    - _Requirements: 12.4_
  
  - [x]* 9.4 Write property test for unauthenticated redirect
    - **Property 27: Unauthenticated Redirect**
    - **Validates: Requirements 12.4**
  
  - [x] 9.5 Write unit tests for routing
    - Test route navigation
    - Test authentication guard
    - Test browser history
    - _Requirements: 12.3, 12.4, 12.5_

- [x] 10. Implement Mobile UI with Felt Grid layout
  - [x] 10.1 Create base GameView component structure
    - Set up portrait-first CSS Grid layout
    - Define viewport sections: header (10%), partner (15%), play area (45%), user hand (30%)
    - _Requirements: 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_
  
  - [x] 10.2 Implement GameHeader component
    - Display trump suit indicator
    - Display crown holder indicator
    - Display team scores
    - _Requirements: 7.5, 4.4, 5.5_
  
  - [x] 10.3 Implement FeltGrid component
    - Create PartnerDisplay (top position)
    - Create OpponentDisplay (left and right positions)
    - Create TrickArea (center)
    - Create UserHand (bottom, thumb-zone)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 10.4 Implement card playability visualization
    - Calculate playable cards using canPlayCard()
    - Apply dimming styles to unplayable cards
    - Apply full brightness to playable cards
    - Disable click handlers on unplayable cards
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [x] 10.4.1 Implement re-dealing UI message
    - Display "Re-dealing..." message when re-deal is triggered
    - Show message during re-deal validation loop
    - Clear message when valid deal is achieved
    - _Requirements: 21.6_
  
  - [x]* 10.5 Write property test for playability calculation
    - **Property 21: Playability Calculation Correctness**
    - **Validates: Requirements 8.1**
  
  - [x]* 10.6 Write property tests for card styling
    - **Property 22: Unplayable Card Styling**
    - **Property 23: Playable Card Styling**
    - **Validates: Requirements 8.2, 8.3**
  
  - [x] 10.7 Implement active player turn indication
    - Display pulsing ring animation around active player avatar
    - _Requirements: 9.1_
  
  - [x]* 10.8 Write property test for active player indication
    - **Property 24: Active Player Indication**
    - **Validates: Requirements 9.1**

- [x] 11. Implement card animation system
  - [x] 11.1 Create card animation utilities
    - Implement CSS transform-based animations
    - Create animateCardPlay() function
    - Ensure 60 FPS performance with GPU acceleration
    - _Requirements: 15.1, 15.2, 15.4_
  
  - [x] 11.2 Implement card play animation
    - Animate card from player hand to trick area
    - Duration: 500ms
    - _Requirements: 15.1, 15.4_
  
  - [x] 11.3 Implement trick collection animation
    - Animate all trick cards to winner's position
    - Duration: 500ms
    - _Requirements: 15.3, 15.4_
  
  - [x] 11.4 Implement touch gesture handling
    - Handle tap events on cards
    - Handle swipe gestures for card selection
    - _Requirements: 15.5_
  
  - [x] 11.5 Write unit tests for animations
    - Test animation timing
    - Test animation completion callbacks
    - Test touch event handling
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 12. Implement Haptic Controller
  - [x] 12.1 Create HapticController class
    - Check for Vibration API support
    - Implement triggerYourTurn() - single 50ms pulse
    - Implement triggerTrickWon() - double pulse pattern
    - Implement triggerTrumpDeclared() - triple pulse pattern
    - Implement triggerVictory() - celebration pattern
    - _Requirements: 2.5, 9.2, 9.3, 9.4, 16.3_
  
  - [x] 12.2 Write unit tests for haptic patterns
    - Test each vibration pattern
    - Test graceful degradation when API unavailable
    - _Requirements: 2.5, 9.2, 9.3, 9.4_

- [x] 13. Implement TrumpSelector and modal components
  - [x] 13.1 Create TrumpSelector modal component
    - Display 4 suit options to crown holder
    - Handle suit selection
    - Trigger trump declaration animation
    - _Requirements: 2.2, 2.4_
  
  - [x] 13.2 Create RoundEndModal component
    - Display round winner and points awarded
    - Show updated scores
    - Provide "Continue" button
    - _Requirements: 16.1_
  
  - [x] 13.3 Create VictoryModal component
    - Display winning team and final scores
    - Trigger victory haptic pattern
    - Provide "New Game" and "Return to Lobby" buttons
    - _Requirements: 16.2, 16.3, 16.4, 16.5_
  
  - [x] 13.4 Write unit tests for modal components
    - Test modal display logic
    - Test button interactions
    - Test data display
    - _Requirements: 2.2, 16.1, 16.2, 16.4, 16.5_

- [ ] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement offline game mode integration
  - [x] 15.1 Create offline game controller
    - Initialize game state with 3 bots
    - Wire GameEngine, BotManager, and UI together
    - Handle game loop entirely in browser
    - _Requirements: 10.1, 10.4_
  
  - [x] 15.2 Implement bot turn automation
    - Detect when bot's turn arrives
    - Call BotManager.selectCard() with 1s timeout
    - Apply bot's card play to game state
    - _Requirements: 10.2_
  
  - [x] 15.3 Create OfflineGameView component
    - Integrate offline controller with Mobile UI
    - Display "Offline Mode" indicator
    - Provide "Return to Lobby" button
    - _Requirements: 10.1, 10.4_
  
  - [x]* 15.4 Write integration tests for offline mode
    - Test full game flow from start to completion
    - Verify all phases transition correctly
    - Verify scoring accumulates correctly
    - Verify crown rotation works correctly
    - _Requirements: 10.1, 10.2, 10.4, 10.5_

- [x] 16. Set up PWA shell for browser testing
  - [x] 16.1 Create index.html app shell
    - Create public/index.html with viewport meta tags
    - Include viewport-fit=cover for safe area insets
    - Add mount point div for app content
    - Link manifest.json
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 16.2 Set up TailwindCSS configuration
    - Create tailwind.config.ts with DaisyUI plugin
    - Create postcss.config.js
    - Create src/ui/styles/main.css with Tailwind directives
    - Configure content paths for tree-shaking
    - _Requirements: 6.3_

  - [x] 16.3 Create CSS styles for Felt Grid layout
    - Define CSS Grid for .felt-grid (portrait layout)
    - Style header, partner, opponents, trick area, user hand
    - Style card elements (playable/unplayable states)
    - Style modals (trump selector, round end, victory)
    - Style animations (pulsing ring, card flight)
    - _Requirements: 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 8.2, 8.3_

  - [x] 16.4 Create app bootstrap entry point
    - Create src/ui/app.ts that mounts UI to DOM
    - Initialize router, create OfflineGameView
    - Wire /offline route to launch game view
    - Handle root redirect to /offline for quick testing
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 16.5 Update build script for CSS processing
    - Add TailwindCSS build step to build:client script
    - Ensure CSS is output to dist/client/styles.css
    - Update index.html to reference built CSS
    - _Requirements: 18.4_

  - [x] 16.6 Set up Elysia static file serving
    - Configure Elysia to serve dist/client/ as static
    - Serve index.html as fallback for SPA routes
    - Update dev script to watch and rebuild client
    - _Requirements: 20.3_

  - [x] 16.7 Verify browser testing works
    - Run bun run dev and open http://localhost:3000
    - Verify offline game renders with Felt Grid layout
    - Verify cards are clickable and game progresses
    - Verify mobile viewport renders correctly
    - _Requirements: 6.3, 7.1, 8.1, 10.4_

- [x] 17. Optimize mobile Felt Grid layout and trick display
  - [x] 17.1 Implement 3x3 grid layout without separate header
    - Expand felt-grid CSS to 9-cell grid: top-left, partner, top-right, left-opp, trick, right-opp, bottom-left, user-hand, bottom-right
    - Add topLeft, topRight, bottomLeft, bottomRight elements to FeltGrid class
    - Remove GameHeader component usage from GameView
    - Move trump indicator, crown holder, and scores into grid corner cells
    - _Requirements: 6.4, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 17.2 Add trick display buffer for played cards
    - Add trickDisplayCards buffer in GameView to hold played cards visually
    - After each card play (user or bot), push played card to display buffer
    - Render display buffer cards in trick area so all 4 cards remain visible until collection
    - Clear display buffer only after animateTrickCollection completes
    - _Requirements: 15.1, 15.3_

  - [x] 17.3 Force human trump declaration on first round
    - Add roundNumber counter to OfflineGameController
    - On first round, set crownHolder to userPlayerIndex so human declares trump
    - On subsequent rounds, use normal Crown Rule (crownHolder = (dealer + 1) % 4)
    - Show trump selector modal automatically for human on round start
    - _Requirements: 2.1, 2.2, 4.1, 4.2, 10.1_

  - [x] 17.4 Update CSS for compact grid corner cells
    - Style top-left cell for trump suit indicator (small, unobtrusive)
    - Style top-right cell for crown icon + compact score display
    - Style bottom-left cell for trick count (e.g., "3/8")
    - Style bottom-right cell for return-to-lobby button
    - Ensure corner cells occupy minimal space to maximize trick area and hand area
    - _Requirements: 6.3, 6.4, 7.5_

- [x] 33. Implement Game Menu with Played Cards Viewer
  - [x] 33.1 Create GameMenu class with DaisyUI dropdown styling
    - Create src/ui/game-menu.ts
    - Implement dropdown menu with "View Played Cards" option
    - Add click-outside-to-close behavior
    - _Requirements: 22.1, 22.9_

  - [x] 33.2 Create PlayedCardsModal class
    - Create modal with close button (DaisyUI modal)
    - Add backdrop click dismiss functionality
    - Implement empty state display
    - _Requirements: 22.3, 22.7_

  - [x] 33.3 Integrate menu icon in FeltGrid
    - Replace static menu-icon with clickable element
    - Wire up show/hide handlers to GameMenu
    - _Requirements: 22.1_

  - [x] 33.4 Implement played cards filtering logic
    - Filter completed tricks by user's team wins only
    - Get player labels relative to user position
    - Handle current trick display when applicable
    - _Requirements: 22.4, 22.5, 22.6, 22.8_

  - [x] 33.5 Render played cards in modal
    - Display each trick as a row with 4 cards
    - Show suit symbol + rank + player label for each card
    - Apply suit color (red/black) styling
    - Handle empty state message
    - _Requirements: 22.4, 22.5, 22.6, 22.7_

  - [x] 33.6 Add CSS styling
    - Style dropdown menu with DaisyUI dropdown pattern
    - Style modal with DaisyUI modal pattern
    - Style played cards grid with player labels
    - Style empty state with centered message
    - _Requirements: 22.1, 22.3_

  - [x] 33.7 Integrate GameMenu with GameView
    - Add GameMenu to GameView components
    - Wire up menu and modal handlers
    - Ensure proper render order
    - _Requirements: 22.1, 22.2_

  - [ ]* 33.8 Write unit tests for GameMenu
    - Test menu toggle behavior
    - Test trick filtering (team-specific)
    - Test player label assignment
    - Test current trick handling
    - Test empty state display
    - _Requirements: 22.4, 22.5, 22.6, 22.7, 22.8_

- [x] 18. Implement login and lobby views
  - [x] 18.1 Create LoginView component
    - Username and password input fields
    - Login button with SessionManager integration
    - Registration link navigating to /register
    - _Requirements: 12.1, 13.1_
  
  - [x] 18.2 Create LobbyView component
    - Display user statistics (if logged in)
    - "Create Game" button (if logged in)
    - "Join Game" button (if logged in)
    - "Play Offline" button (always available)
    - Logout button (if logged in)
    - _Requirements: 12.1_

  - [x]* 18.3 Write unit tests for login and lobby
    - Test login form submission
    - Test navigation to offline game
    - Test offline mode launch without authentication
    - _Requirements: 12.1, 12.2, 12.3, 13.1_

- [x] 18.4 Implement user registration view
  - [x] 18.4.1 Create RegistrationView component
    - Username input field (required, no special validation)
    - Password input field (minimum 4 characters)
    - Register button
    - "Back to Login" link
    - _Requirements: 13.1_

  - [x] 18.4.2 Add /register route to Page.js router
    - Register route handler for /register path
    - Render RegistrationView component
    - _Requirements: 12.1, 12.2_

  - [x] 18.4.3 Implement registration form submission
    - Validate username is not empty
    - Validate password is at least 4 characters
    - Call POST /api/register endpoint
    - On success: auto-login, save session, redirect to /lobby
    - On error: display error message (e.g., username taken)
    - _Requirements: 13.1_

  - [x] 18.4.4 Write unit tests for registration
    - Test form validation (empty username, short password)
    - Test successful registration and redirect
    - Test error handling (duplicate username)
    - Test navigation back to login
    - _Requirements: 13.1_

- [x] 18.5 Implement registration API endpoint
  - [x] 18.5.1 Create POST /api/register endpoint
    - Accept username and password in request body
    - Validate username is not empty
    - Validate password is at least 4 characters
    - Check if username already exists in LokiJS
    - Hash password before storing
    - Create UserDocument in users collection
    - Generate session token (30-day expiry)
    - Return session token and user data on success
    - Return 409 Conflict if username already exists
    - Return 400 Bad Request for validation errors
    - _Requirements: 13.1, 14.1_

  - [x] 18.5.2 Update LokiJS user registration function
    - Create registerUser() function in persistence layer
    - Check for duplicate usernames
    - Hash password using bcrypt or similar
    - Insert new user into users collection
    - Return created user document
    - _Requirements: 14.1, 14.4_

  - [x] 18.5.3 Write unit tests for registration API
    - Test successful user registration
    - Test duplicate username rejection
    - Test validation errors (empty username, short password)
    - Test password hashing verification
    - Test session token generation
    - _Requirements: 13.1, 14.1_

- [x] 19. Checkpoint - Ensure offline play is fully functional
  - Test complete offline game flow from lobby to victory
  - Verify all game rules work correctly
  - Verify UI responsiveness and animations
  - Ask the user if they want to proceed with online multiplayer

- [x] 20. Implement Session Manager
  - [x] 20.1 Create SessionManager class
    - Implement login() function with token creation
    - Implement logout() function with token clearing
    - Implement getSession() to retrieve from localStorage
    - Implement isAuthenticated() check
    - _Requirements: 13.1, 13.2, 13.3, 13.5_

  - [x]* 20.2 Write property test for session token expiration
    - **Property 28: Session Token Expiration**
    - **Validates: Requirements 13.2**

  - [x]* 20.3 Write property test for expired token redirect
    - **Property 29: Expired Token Redirect**
    - **Validates: Requirements 13.4**

  - [x]* 20.4 Write unit tests for session management
    - Test token creation and storage
    - Test auto-authentication on app load
    - Test logout functionality
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 21. Implement LokiJS persistence layer
  - [x] 21.1 Set up LokiJS database
    - Create users collection
    - Create games collection
    - Create statistics collection
    - Configure auto-save every 5 minutes
    - Configure load on startup
    - _Requirements: 14.1, 14.3, 14.4_

  - [x] 21.2 Implement user authentication with LokiJS
    - Create user registration function
    - Create user login function with password hashing
    - Integrate with SessionManager
    - _Requirements: 13.1_

  - [x] 21.3 Implement game result persistence
    - Save game record on completion
    - Store player IDs, winner, scores, rounds, timestamp
    - _Requirements: 14.2_

  - [x]* 21.4 Write property test for game result persistence
    - **Property 30: Game Result Persistence**
    - **Validates: Requirements 14.2**

  - [x] 21.5 Implement statistics tracking
    - Update games played count
    - Update games won count
    - Update total points scored
    - Calculate average points per game
    - _Requirements: 14.5_

  - [x]* 21.6 Write property test for statistics update
    - **Property 31: Statistics Update**
    - **Validates: Requirements 14.5**

  - [x]* 21.7 Write unit tests for persistence layer
    - Test user CRUD operations
    - Test game record creation
    - Test statistics calculations
    - Test auto-save and load
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 22. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. Implement Colyseus server with CrownRoom
  - [x] 23.1 Set up Colyseus server with ElysiaJS
    - Initialize Colyseus server
    - Configure WebSocket transport
    - Register CrownRoom
    - _Requirements: 11.1, 11.6_

  - [x] 23.2 Implement CrownRoom class
    - Implement onCreate() - initialize game state
    - Implement onJoin() - add player to game
    - Implement onLeave() - handle disconnection
    - Implement onDispose() - cleanup
    - _Requirements: 11.1_

  - [x] 23.3 Implement declareTrump command with validation
    - Validate player is crown holder
    - Validate game phase is TRUMP_DECLARATION
    - Apply trump declaration to state
    - Broadcast state update
    - _Requirements: 11.2_

  - [x] 23.4 Implement playCard command with validation
    - Validate it's player's turn
    - Validate card is in player's hand
    - Validate card can be played (suit following)
    - Apply card play to state
    - Broadcast state update
    - _Requirements: 11.2_

  - [x] 23.5 Write property test for server action validation
    - **Property 26: Server Action Validation**
    - **Validates: Requirements 11.2**

  - [x] 23.6 Implement state synchronization
    - Broadcast state updates within 100ms
    - Send full state on player join
    - _Requirements: 11.3_

  - [x] 23.7 Implement reconnection handling
    - Pause game on player disconnect
    - Wait 60 seconds for reconnection
    - Resume game on reconnection
    - Replace with bot after timeout
    - _Requirements: 11.4, 11.5_

  - [x] 23.8 Write unit tests for Colyseus server
    - Test room creation and joining
    - Test action validation
    - Test state broadcasting
    - Test reconnection logic
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 24. Implement online multiplayer client integration
  - [x] 24.1 Create Colyseus client wrapper
    - Connect to Colyseus server via WebSocket
    - Handle connection state changes
    - Send actions to server
    - Receive state updates from server
    - _Requirements: 11.1, 11.3_

  - [x] 24.2 Implement online game controller
    - Initialize connection to game room
    - Send declareTrump action to server
    - Send playCard action to server
    - Update UI on state changes from server
    - _Requirements: 11.2, 11.3_

  - [x] 24.3 Implement reconnection UI
    - Display reconnection indicator on disconnect
    - Show countdown timer (60s)
    - Restore game state on reconnection
    - _Requirements: 11.4, 19.1, 19.2_

  - [x]* 24.4 Write integration tests for online mode
    - Test full multiplayer game with 4 connected clients
    - Verify state synchronization across all clients
    - Verify reconnection handling
    - Verify bot replacement on timeout
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 25. Implement headless testing script
  - [ ] 25.1 Create headless test script
    - Simulate 3 bot players joining room
    - Run full game to completion
    - Verify game rules enforced by server
    - Target completion time < 10 seconds
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ]* 25.2 Write integration test using headless script
    - Test server processes game correctly
    - Test all phases transition
    - Test scoring and crown rotation
    - _Requirements: 17.2, 17.3, 17.4_

- [ ] 26. Implement error handling and recovery
  - [ ] 26.1 Implement client-side error handling
    - Add global error boundary
    - Handle network errors with retry logic
    - Handle invalid state errors
    - Display user-friendly error messages
    - _Requirements: 19.1, 19.2, 19.4_

  - [ ] 26.2 Implement server-side error handling
    - Validate game state invariants
    - Handle database errors with retry
    - Log all errors with context
    - _Requirements: 19.3_

  - [ ] 26.3 Implement error reporting
    - Create error report interface
    - Capture error details (stack, state, context)
    - Provide "Report Issue" button
    - _Requirements: 19.5_

  - [ ]* 26.4 Write unit tests for error handling
    - Test network error recovery
    - Test state validation
    - Test error reporting
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [ ] 27. Implement performance optimizations
  - [ ] 27.1 Optimize initial load time
    - Code splitting for routes
    - Lazy load non-critical components
    - Compress assets
    - Target < 2s on 3G connection
    - _Requirements: 18.1, 18.4_

  - [ ] 27.2 Optimize card play response time
    - Debounce touch events
    - Optimize state updates
    - Target < 100ms response
    - _Requirements: 18.2_

  - [ ] 27.3 Optimize animation performance
    - Use CSS transforms for GPU acceleration
    - Reduce layout thrashing
    - Target 60 FPS
    - _Requirements: 18.3_

  - [ ] 27.4 Optimize game engine performance
    - Profile trick resolution logic
    - Optimize card validation
    - Target < 50ms processing time
    - _Requirements: 18.5_

  - [ ]* 27.5 Write performance tests
    - Test initial load time
    - Test card play response time
    - Test animation frame rate
    - Test bundle size
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 28. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 29. Set up deployment configuration
  - [ ] 29.1 Create Dockerfile for Render deployment
    - Use Bun as base image
    - Copy source files
    - Install dependencies
    - Expose WebSocket port
    - _Requirements: 20.1, 20.4_

  - [ ] 29.2 Configure LokiJS persistence for ephemeral filesystem
    - Set up periodic backups
    - Configure external volume mounting
    - Implement restore on startup
    - _Requirements: 20.2_

  - [ ] 29.3 Configure static file serving
    - Serve PWA assets from same Render instance
    - Configure HTTPS
    - _Requirements: 20.3_

  - [ ] 29.4 Configure automatic restart on crash
    - Set up health check endpoint
    - Configure restart policy
    - _Requirements: 20.5_

  - [ ]* 29.5 Write deployment verification tests
    - Test Docker build succeeds
    - Test server starts correctly
    - Test static files served
    - _Requirements: 20.1, 20.3, 20.4, 20.5_

- [ ] 30. Create E2E tests for mobile UI
  - [ ]* 30.1 Set up Playwright with mobile viewport
    - Configure 375x667 viewport
    - Set up touch event simulation
    - _Requirements: 18.1_

  - [ ]* 30.2 Write E2E tests for offline game flow
    - Test offline game creation
    - Test card play interactions
    - Test trump declaration
    - Test round completion
    - _Requirements: 6.3, 8.1, 15.5_

  - [ ]* 30.3 Write E2E tests for online game flow
    - Test online game creation
    - Test multiplayer card play
    - Test reconnection flow
    - _Requirements: 11.1, 11.3, 11.4_

  - [ ]* 30.4 Write E2E tests for PWA installation
    - Test manifest.json served correctly
    - Test standalone mode launch
    - _Requirements: 6.1, 6.2_

  - [ ]* 30.5 Write E2E tests for navigation
    - Test route transitions
    - Test authentication guard
    - Test back button navigation
    - _Requirements: 12.2, 12.3, 12.4, 12.5_

- [x] 34. Implement dual-layer theme system
  - [x] 34.1 Create CSS custom property design tokens
  - [x] 34.2 Define 5 application themes with CSS variables
  - [x] 34.3 Refactor tailwind.config.ts for theme integration
  - [x] 34.4 Refactor main.css to use CSS variables
  - [x] 34.5 Update public/index.html and manifest.json
  - [x] 34.6 Create theme manager utility
  - [x] 34.7 Add theme toggle to GameMenu
  - [x] 34.8 Write unit tests for theme system
    - Test CSS variable application across all themes
    - Test theme manager get/set/persist functions
    - Test theme toggle in GameMenu
    - Test default theme application on first load
    - Test game-theme variables remain green across all app themes
    - Test felt grid theme variables change per theme
    - _Requirements: 6.3_
  - [x] 34.9 Add felt grid theme-aware background
    - Add --felt-bg and --felt-bg-gradient variables to each theme block
    - Update .felt-grid CSS to use theme-aware variables
    - Golden Ascent: charcoal (#1a1a1a), Emerald: green (#1a472a), Crimson: burgundy (#2a1515), Sapphire: navy (#1e3a5f), Amethyst: purple (#3b1a6e)
    - _Requirements: 6.3, 6.4_
  - [x] 34.10 Add clickable theme badge to lobby footer
    - Add theme badge button in lobby footer with colored dot and theme name
    - Click opens theme selector modal
    - Badge updates when theme changes
    - _Requirements: 6.3_
  - [x] 34.11 Refactor GameMenu theme selector to use CSS classes
    - Remove inline styles from showThemeSelectorModal()
    - Use CSS classes with data-theme-id attributes for theme-specific styling
    - Add .theme-selector-modal and .theme-option-card CSS classes
    - _Requirements: 6.3_
  - [x] 34.12 Replace hardcoded opacity values with CSS classes
    - Replace opacity='0.3' in game-view.ts with .card-animating class
    - Replace opacity='0.3' in card-animation.ts with .card-collected class
    - Add CSS classes for animation states
    - _Requirements: 6.3, 15.2_

- [ ] 31. Final integration and polish
  - [ ] 31.1 Integrate all components into complete application
    - Wire offline mode with UI
    - Wire online mode with UI
    - Connect login/lobby/game views
    - Test full user journey
    - _Requirements: All_

  - [ ] 31.2 Add Tailwind styling and DaisyUI components
    - Style all UI components
    - Ensure mobile-first responsive design
    - Apply theme colors
    - _Requirements: 6.3, 6.4_

  - [ ] 31.3 Test cross-browser compatibility
    - Test on Chrome Mobile
    - Test on Safari iOS
    - Test on Firefox Mobile
    - _Requirements: 18.1, 18.2, 18.3_

  - [ ]* 31.4 Run full test suite
    - Run all unit tests
    - Run all property tests (36 properties)
    - Run all integration tests
    - Run all E2E tests
    - Verify 100% property test coverage
    - _Requirements: All_

- [ ] 32. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, verify deployment readiness, ask the user if questions arise.

- [x] 35. Implement Smart Bot with Team-Shared Memory
  - [x] 35.1 Create TeamMemory class
    - Create src/bot/team-memory.ts
    - Implement TeamMemoryRecord and TeamWonTrickRecord interfaces
    - Implement ourPlays tracking (all cards team played, won or lost)
    - Implement tricksWeWon tracking (complete 4-card trick records)
    - Implement knownCards set for deduplication
    - Implement recalculateRemaining() for perfect card calculation
    - Implement isOpponentVoid() detection from won tricks
    - Implement getUnaccountedHighCards() for A, K, Q tracking
    - Implement getTrumpRemaining() for exact trump count
    - Implement reset() for new round clearing
    - _Requirements: 23.1, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.14_

  - [x] 35.2 Write property tests for TeamMemory
    - **Property 37: Team Memory Tracks All Team Plays**
    - **Property 38: Team Memory Records Complete Won Tricks**
    - **Property 39: Remaining Cards Perfect Calculation**
    - **Property 40: High Card Tracking Accuracy**
    - **Property 41: Opponent Void Detection**
    - **Property 42: Trump Count Accuracy**
    - **Property 48: Memory Reset Per Round**
    - **Property 49: Shared Team Memory**
    - _Requirements: 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.14, 23.15_

  - [x] 35.3 Write unit tests for TeamMemory
    - Test recordOurPlay() correctly logs team plays
    - Test recordTrickWeWon() stores complete trick details
    - Test recalculateRemaining() produces correct remaining cards
    - Test isOpponentVoid() detects voids from won tricks
    - Test getUnaccountedHighCards() tracks A, K, Q accurately
    - Test getTrumpRemaining() returns exact count
    - Test reset() clears all memory
    - Test shared memory between team bots
    - _Requirements: 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.14, 23.15_

  - [x] 35.4 Enhance SmartBot with memory-aware decision logic
    - Update src/bot/bot-logic.ts to accept TeamMemory parameter
    - Implement getBestLeadWithMemory() for memory-aware leading
    - Implement shouldTrump() for strategic trump decisions
    - Implement isEndgame() detection (last 2-3 tricks)
    - Implement calculateEndgameMove() for optimal endgame play
    - Implement partner-aware sloughing (lowest when partner winning)
    - Implement void-aware leading (avoid opponent void suits)
    - Implement trump conservation logic
    - _Requirements: 23.9, 23.10, 23.11, 23.12, 23.13_

  - [x] 35.5 Write property tests for enhanced SmartBot
    - **Property 43: Bot Legal Move Selection with Memory**
    - **Property 44: Partner-Aware Leading**
    - **Property 45: Trump Conservation**
    - **Property 46: Partner Win Recognition**
    - **Property 47: Endgame Optimal Play**
    - _Requirements: 23.9, 23.10, 23.11, 23.12, 23.13_

  - [x] 35.6 Write unit tests for enhanced SmartBot
    - Test leading decisions with various memory states
    - Test following decisions with partner winning
    - Test void-in-led-suit decisions (trump vs slough)
    - Test endgame calculations with exact remaining cards
    - Test partner strength recognition from won tricks
    - Test opponent void exploitation
    - Test trump conservation scenarios
    - _Requirements: 23.9, 23.10, 23.11, 23.12, 23.13_

  - [x] 35.7 Update BotManager with team memory management
    - Update src/bot/bot-manager.ts
    - Create two TeamMemory instances (Team 0 and Team 1)
    - Implement recordTrickResult() to update both team memories
    - Implement resetMemories() for round start
    - Update selectCard() to pass correct team memory to SmartBot
    - Update selectTrumpSuit() with enhanced strategy (high card concentration)
    - _Requirements: 23.1, 23.2, 23.9, 23.15_

  - [x] 35.8 Update OfflineGameController for memory integration
    - Update src/ui/offline-game-controller.ts
    - Call BotManager.recordTrickResult() after each trick completes
    - Call BotManager.resetMemories() at round start
    - Ensure memory updates happen before next trick begins
    - _Requirements: 23.2, 23.14_

  - [x] 35.9 Integration testing for smart bot
    - Test full round with smart bots making memory-aware decisions
    - Verify bots coordinate on same team using shared memory
    - Verify bots conserve trumps appropriately
    - Verify bots recognize partner strength and lead accordingly
    - Verify endgame calculations produce optimal plays
    - _Requirements: 23.9, 23.10, 23.11, 23.12, 23.13, 23.15_

- [x] 36. Implement Waiting Room and Join Room Feature
  - [x] 36.1 Create room code generator
    - Create src/server/room-code-generator.ts
    - Implement generateRoomCode() for 4-char alphanumeric codes
    - Store roomCode -> roomId mapping in server memory
    - Ensure uniqueness with retry on collision
    - _Requirements: 36.3_

  - [x] 36.2 Add room expiry logic to CrownRoom
    - Add roomCode, adminSessionId, roomExpiryAt, roomCreatedAt to GameStateSchema
    - Set 3-minute hard expiry on room creation
    - Auto-dispose expired rooms
    - Broadcast expiry warnings (60s, 30s, 10s)
    - _Requirements: 36.10, 36.11_

  - [x] 36.3 Add team management message handlers
    - Add 'shuffle_teams' handler (admin only)
    - Add 'add_bot' handler (admin only, fills next empty slot)
    - Add 'start_game' handler (admin only)
    - _Requirements: 36.7, 36.8, 36.9, 38.1, 38.3_

  - [x] 36.4 Add available rooms endpoint
    - Create GET /api/rooms endpoint via ElysiaJS
    - Use matchMaker.query() to get active rooms
    - Return rooms with code, player count, admin name
    - _Requirements: 37.3_

  - [x] 36.5 Create WaitingRoomView component
    - Create src/ui/waiting-room-view.ts
    - Implement 2x2 team slot layout
    - Display room code with copy functionality
    - Show admin badge for room creator
    - Show "Waiting for player..." for empty slots
    - _Requirements: 36.1, 36.2, 36.4, 36.5, 36.6_

  - [x] 36.6 Implement countdown timer
    - Display remaining time (MM:SS format)
    - Update every second
    - Show warning styling when < 60s
    - Redirect to /lobby on expiry
    - _Requirements: 36.11_

  - [x] 36.7 Implement admin controls
    - "Start Game" button (admin only, disabled if < 2 players)
    - "Shuffle Teams" button (admin only)
    - "Add Bot" button (admin only, disabled if room full)
    - Wire up message handlers to Colyseus
    - _Requirements: 36.7, 36.8, 36.9_

  - [x] 36.8 Create JoinRoomModal component
    - Create src/ui/join-room-modal.ts
    - Use ModalBottomSheet base class
    - Room code input + Join button
    - Available rooms list from GET /api/rooms
    - _Requirements: 37.1, 37.2, 37.3, 37.4, 37.5_

  - [x] 36.9 Update ColyseusClientWrapper
    - Add getAvailableRooms() method
    - Add shuffleTeams() method
    - Add addBot() method
    - Add startGame() method
    - Add room expiry message handler
    - _Requirements: 36.7, 36.8, 36.9, 36.10_

  - [x] 36.10 Update LobbyView
    - Replace onCreateGame callback to navigate to /waiting/new
    - Replace onJoinGame callback to show JoinRoomModal
    - _Requirements: 36.1, 37.1_

  - [x] 36.11 Update app.ts routing
    - Add /waiting/:roomId route
    - Implement showWaitingRoom(roomId) handler
    - Handle 'new' roomId special case
    - Remove showRoomCodeModal
    - _Requirements: 36.1_

  - [x] 36.12 Update OnlineGameController
    - Add createWaitingRoom() method
    - Add joinWaitingRoom(roomId) method
    - Handle transition from waiting room to game
    - _Requirements: 36.1_

  - [x] 36.13 Add CSS styling
    - Style waiting room layout (2x2 team grid)
    - Style room code display and copy button
    - Style countdown timer
    - Style admin controls
    - Style JoinRoomModal
    - _Requirements: 36.4, 36.5, 36.6_

  - [x]* 36.14 Write unit tests for WaitingRoomView
    - Test room code display and copy
    - Test admin controls visibility
    - Test countdown timer behavior
    - Test shuffle teams functionality
    - _Requirements: 36.3, 36.7, 36.8, 36.9_

  - [x]* 36.15 Write unit tests for JoinRoomModal
    - Test room code input validation
    - Test available rooms list rendering
    - Test join button behavior
    - _Requirements: 37.2, 37.4_

  - [x]* 36.16 Write unit tests for server handlers
    - Test room code generation uniqueness
    - Test expiry timer logic
    - Test team shuffle algorithm
    - Test admin-only action validation
    - _Requirements: 36.3, 36.7, 36.8, 36.9, 36.10_

  - [x]* 36.17 Integration testing
    - Test full create room flow
    - Test join room via code and list
    - Test team shuffle and bot addition
    - Test room expiry and redirect
    - _Requirements: All_

- [ ] 37. Fix Online Multiplayer Player-Specific Views and Card Dealing
  - [ ] 37.1 Update CrownRoom to properly initialize players before dealing
    - Ensure all 4 player slots are filled (human or bot) before calling dealInitial()
    - Verify gameState.players array has 4 entries with proper team assignments
    - Call dealInitial(gameState) to deal 4 cards to each player
    - After trump declaration, call dealFinal(gameState) to deal 4 more cards
    - Verify each player receives unique cards (no duplicates across players)
    - _Requirements: 11.7, 11.9, 39.5, 39.6, 39.7_

  - [ ] 37.2 Store user's server player index in OnlineGameController
    - When joining room, extract and store the player index assigned by server
    - Add getUserServerPlayerIndex() method to retrieve stored index
    - Update constructor to accept optional userPlayerIndex parameter
    - Store player index from onJoin callback or room state
    - _Requirements: 39.1, 39.9_

  - [ ] 37.3 Implement player index mapping in OnlineGameController
    - Create getViewPosition(serverPlayerIndex) method: (serverPlayerIndex - userPlayerIndex + 4) % 4
    - Create getServerIndex(viewPosition) method: (viewPosition + userPlayerIndex) % 4
    - Implement rotatePlayersForView() to reorder players array for client view
    - Ensure user is always at view position 0 (bottom)
    - _Requirements: 39.2, 39.4_

  - [ ] 37.4 Update mapSchemaToGameState to rotate player indices
    - Rotate players array so user appears at index 0
    - Rotate currentPlayer index to view position
    - Rotate crownHolder index to view position
    - Rotate trumpDeclarer index to view position
    - Rotate dealer index to view position
    - Rotate currentTrick.cards player indices to view positions
    - Rotate completedTricks card player indices to view positions
    - _Requirements: 39.2, 39.4, 39.10_

  - [ ] 37.5 Update GameView to use userPlayerIndex for rendering
    - Pass userPlayerIndex to render() method (always 0 for rotated view)
    - Ensure user's hand is rendered at bottom with full card details
    - Ensure partner is rendered at top (view position 2)
    - Ensure opponents are rendered at left (view position 1) and right (view position 3)
    - Display card backs or card counts for non-user players
    - _Requirements: 39.3, 39.4, 39.8, 7.6, 7.7_

  - [ ] 37.6 Fix bot initialization in CrownRoom.startGame()
    - Before calling dealInitial(), ensure all 4 player slots exist in gameState.players
    - For each empty slot (0-3), call addBotToSlot(i) to create bot player
    - Verify bots are added to both state.players (schema) and gameState.players (engine)
    - Ensure bot players have proper team assignments (even indices = Team 0, odd = Team 1)
    - _Requirements: 11.9, 39.6_

  - [ ] 37.7 Update handleStartGame to initialize bots before dealing
    - Move bot initialization before dealInitial() call
    - Ensure gameState is properly initialized with 4 players
    - Verify team assignments are correct before dealing
    - _Requirements: 11.9, 39.6_

  - [ ] 37.8 Add player index to OnlineGameController state callbacks
    - Update onStateChange callback to include userPlayerIndex
    - Ensure GameView receives correct userPlayerIndex for rendering
    - Update WaitingRoomView to track user's assigned player index
    - _Requirements: 39.1, 39.9_

  - [ ]* 37.9 Write property test for player index mapping
    - **Property 50: Player Index Mapping Correctness**
    - For any userPlayerIndex (0-3) and serverPlayerIndex (0-3), getViewPosition() followed by getServerIndex() SHALL return the original serverPlayerIndex
    - For any userPlayerIndex, the user SHALL always map to view position 0
    - **Validates: Requirements 39.2**

  - [ ]* 37.10 Write property test for unique card dealing
    - **Property 51: Unique Card Dealing in Online Mode**
    - For any game state after dealing, no two players SHALL have identical hands
    - For any game state after dealing, the union of all player hands SHALL equal the dealt cards
    - **Validates: Requirements 11.7, 39.5**

  - [ ]* 37.11 Write integration tests for online multiplayer views
    - Test that 4 clients joining the same room each see themselves at the bottom
    - Test that each client sees different cards in their hand
    - Test that partner and opponents are positioned correctly relative to each client
    - Test that trick cards display in correct positions for each client's perspective
    - _Requirements: 39.3, 39.4, 39.8, 39.10_

  - [ ] 37.12 Update OnlineGameController to handle bot turns
    - When current player is a bot, trigger bot decision via BotManager
    - Ensure bot plays are sent to server via playCard message
    - Handle bot trump declaration when bot is crown holder
    - _Requirements: 11.9, 39.6_

  - [ ] 37.13 Test online multiplayer with mixed human and bot players
    - Create room with 1 human admin
    - Add 3 bots via "Add Bot" button
    - Start game and verify all 4 players receive unique cards
    - Verify human sees their cards at bottom, bots at other positions
    - Verify bots make legal moves and game progresses correctly
    - _Requirements: 11.9, 39.5, 39.6, 39.7_

  - [ ] 37.14 Add player name display to FeltGrid
    - Update FeltGrid.render() to accept playerNames array parameter
    - Update renderPartnerDisplay() to display actual username instead of "Partner"
    - Update renderSingleOpponent() to display actual username instead of "Left"/"Right"
    - Update renderUserDisplay() to display "You" or user's username
    - Ensure username is displayed in .player-name element for all positions
    - _Requirements: 40.1, 40.2, 40.3, 40.9_

  - [ ] 37.15 Update GameView to pass player names to FeltGrid
    - Extract player usernames from gameState.players array
    - Create playerNames array with 4 usernames indexed by player position
    - Pass playerNames to FeltGrid.render() method
    - Ensure names are rotated to match client view positions
    - _Requirements: 40.7, 40.8_

  - [ ] 37.16 Update OnlineGameController to extract player names from server state
    - In mapSchemaToGameState(), extract username from each PlayerSchema
    - Store usernames in rotated order matching client view positions
    - Pass player names to GameView.render() method
    - Ensure user's own name is at position 0 after rotation
    - _Requirements: 40.7_

  - [ ] 37.17 Update CrownRoom to include player usernames in state sync
    - Ensure PlayerSchema.username is set when players join
    - Ensure bot usernames are set when bots are added
    - Verify username field is synchronized to all clients via Colyseus
    - _Requirements: 40.5, 40.6_

  - [ ] 37.18 Add trump declarer name display to top-right scores cell
    - Update renderTopRight() to show trump declarer's username when trump is declared
    - Display format: "🗣️ {username}" when trumpDeclarer is set
    - Fall back to crown holder display when trump not yet declared
    - Use actual username instead of positional label (L, P, R)
    - _Requirements: 40.4_

  - [ ] 37.19 Update CSS styling for username display
    - Ensure .player-name has appropriate font size and color
    - Add text-overflow: ellipsis for long usernames
    - Ensure usernames are visible in all themes
    - Test username display in portrait and landscape orientations
    - _Requirements: 40.10_

  - [ ]* 37.20 Write unit tests for player name display
    - Test FeltGrid renders correct usernames for all positions
    - Test "You" is displayed for user's own position
    - Test trump declarer name is displayed correctly
    - Test username rotation matches player index rotation
    - Test long usernames are truncated appropriately
    - _Requirements: 40.1, 40.2, 40.3, 40.4, 40.9_

  - [ ]* 37.21 Integration test for player names in online multiplayer
    - Test 4 players join room with different usernames
    - Verify each client sees correct usernames for all positions
    - Verify trump declarer's name is displayed when trump is declared
    - Verify usernames persist across trick plays and round transitions
    - _Requirements: 40.5, 40.6, 40.7, 40.8, 40.10_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- All 51 correctness properties have corresponding property tests (36 original + 13 bot memory + 2 new online multiplayer properties)
- Property tests use fast-check with minimum 100 iterations
- Checkpoints ensure incremental validation at key milestones
- **NEW WORKFLOW**: Implementation now prioritizes offline play testing before online multiplayer
- Implementation follows phased approach: Core Engine → PWA Shell → Mobile UI → Offline Mode → Login/Lobby → Session/Persistence → Online Mode → Deployment
- Testing strategy combines unit tests (specific examples) with property tests (universal correctness)
- Task 19 is a critical checkpoint to test offline play before proceeding with online features
- **Task 37 addresses critical online multiplayer bug**: Fixes player-specific views and unique card dealing
