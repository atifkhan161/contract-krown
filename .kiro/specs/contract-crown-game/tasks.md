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

- [ ] 4. Implement trick-taking core logic
  - [ ] 4.1 Implement first trick leader determination
    - Calculate (dealer + 1) % 4 as first lead player
    - _Requirements: 3.1_
  
  - [ ]* 4.2 Write property test for first trick leader
    - **Property 7: First Trick Leader**
    - **Validates: Requirements 3.1**
  
  - [ ] 4.3 Implement turn order progression
    - Advance current player clockwise after each card play
    - _Requirements: 3.2_
  
  - [ ]* 4.4 Write property test for turn order progression
    - **Property 8: Turn Order Progression**
    - **Validates: Requirements 3.2**
  
  - [ ] 4.5 Implement canPlayCard() validation function
    - Check if player is leading (all cards playable)
    - Check suit-following requirements when following
    - Check if player has no cards of led suit (all cards playable)
    - _Requirements: 3.3, 3.4, 3.5_
  
  - [ ]* 4.6 Write property tests for card playability rules
    - **Property 9: Lead Player Freedom**
    - **Property 10: Suit Following Requirement**
    - **Property 11: No Suit Following Freedom**
    - **Validates: Requirements 3.3, 3.4, 3.5, 8.4**
  
  - [ ] 4.7 Implement playCard() function
    - Validate card can be played
    - Remove card from player hand
    - Add card to current trick
    - Advance turn
    - _Requirements: 3.2_
  
  - [ ] 4.8 Implement resolveTrick() function
    - Determine highest trump card if any trump played
    - Otherwise determine highest card of led suit
    - Return winner player index
    - _Requirements: 3.6, 3.7_
  
  - [ ]* 4.9 Write property test for trick resolution
    - **Property 12: Trick Resolution Correctness**
    - **Validates: Requirements 3.6, 3.7**
  
  - [ ] 4.10 Implement trick winner leads next logic
    - Set next trick's lead player to previous trick winner
    - _Requirements: 3.8_
  
  - [ ]* 4.11 Write property test for trick winner leads next
    - **Property 13: Trick Winner Leads Next**
    - **Validates: Requirements 3.8**

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Crown Rule and scoring system
  - [ ] 6.1 Implement crown retention logic
    - Check if declaring team won >= 5 tricks
    - Retain crown holder if condition met
    - _Requirements: 4.1_
  
  - [ ]* 6.2 Write property test for crown retention
    - **Property 14: Crown Retention on Success**
    - **Validates: Requirements 4.1**
  
  - [ ] 6.3 Implement crown rotation logic
    - Pass crown clockwise if declaring team won < 5 tricks
    - Calculate (currentCrownHolder + 1) % 4
    - _Requirements: 4.2_
  
  - [ ]* 6.4 Write property test for crown rotation
    - **Property 15: Crown Rotation on Failure**
    - **Validates: Requirements 4.2**
  
  - [ ] 6.5 Implement dealer rotation logic
    - Rotate dealer clockwise every round
    - Calculate (currentDealer + 1) % 4
    - _Requirements: 4.3_
  
  - [ ]* 6.6 Write property test for dealer rotation
    - **Property 16: Dealer Rotation**
    - **Validates: Requirements 4.3**
  
  - [ ] 6.7 Implement winner-takes-all scoring
    - Award T points to declaring team if T >= 5
    - Award challenging team's trick count if declaring team < 5
    - _Requirements: 5.1, 5.2_
  
  - [ ]* 6.8 Write property tests for scoring rules
    - **Property 17: Declaring Team Success Scoring**
    - **Property 18: Challenging Team Success Scoring**
    - **Validates: Requirements 5.1, 5.2**
  
  - [ ] 6.9 Implement score accumulation
    - Maintain cumulative scores across rounds
    - _Requirements: 5.3_
  
  - [ ]* 6.10 Write property test for score accumulation
    - **Property 19: Score Accumulation**
    - **Validates: Requirements 5.3**
  
  - [ ] 6.11 Implement game completion detection
    - Check if either team >= 52 points
    - Transition to GAME_END phase
    - _Requirements: 5.4_
  
  - [ ]* 6.12 Write property test for game completion
    - **Property 20: Game Completion**
    - **Validates: Requirements 5.4**

- [ ] 7. Implement Bot Manager for AI opponents
  - [ ] 7.1 Create BotManager class with strategy logic
    - Implement selectTrumpSuit() - choose suit with most cards
    - Implement selectCard() with basic strategy
    - Add timing delays (500-1500ms) for human-like behavior
    - _Requirements: 10.1, 10.2, 10.5_
  
  - [ ]* 7.2 Write property test for bot legal move selection
    - **Property 25: Bot Legal Move Selection**
    - **Validates: Requirements 10.2, 10.3**
  
  - [ ]* 7.3 Write unit tests for bot strategy
    - Test trump selection logic
    - Test card selection in various scenarios
    - Test timing delays are within range
    - _Requirements: 10.2, 10.5_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement PWA Shell and routing
  - [ ] 9.1 Create manifest.json for PWA
    - Define app name, icons, display mode (standalone)
    - Configure theme colors and orientation
    - _Requirements: 6.1, 6.2_
  
  - [ ] 9.2 Implement Page.js routing
    - Set up routes: /login, /lobby, /game/:roomId, /offline
    - Implement route handlers
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [ ] 9.3 Implement authentication guard middleware
    - Check session on protected routes
    - Redirect to /login if not authenticated
    - Allow /offline route without authentication
    - _Requirements: 12.4_
  
  - [ ]* 9.4 Write property test for unauthenticated redirect
    - **Property 27: Unauthenticated Redirect**
    - **Validates: Requirements 12.4**
  
  - [ ]* 9.5 Write unit tests for routing
    - Test route navigation
    - Test authentication guard
    - Test browser history
    - _Requirements: 12.3, 12.4, 12.5_

- [ ] 10. Implement Mobile UI with Felt Grid layout
  - [ ] 10.1 Create base GameView component structure
    - Set up portrait-first CSS Grid layout
    - Define viewport sections: header (10%), partner (15%), play area (45%), user hand (30%)
    - _Requirements: 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_
  
  - [ ] 10.2 Implement GameHeader component
    - Display trump suit indicator
    - Display crown holder indicator
    - Display team scores
    - _Requirements: 7.5, 4.4, 5.5_
  
  - [ ] 10.3 Implement FeltGrid component
    - Create PartnerDisplay (top position)
    - Create OpponentDisplay (left and right positions)
    - Create TrickArea (center)
    - Create UserHand (bottom, thumb-zone)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ] 10.4 Implement card playability visualization
    - Calculate playable cards using canPlayCard()
    - Apply dimming styles to unplayable cards
    - Apply full brightness to playable cards
    - Disable click handlers on unplayable cards
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ] 10.4.1 Implement re-dealing UI message
    - Display "Re-dealing..." message when re-deal is triggered
    - Show message during re-deal validation loop
    - Clear message when valid deal is achieved
    - _Requirements: 21.6_
  
  - [ ]* 10.5 Write property test for playability calculation
    - **Property 21: Playability Calculation Correctness**
    - **Validates: Requirements 8.1**
  
  - [ ]* 10.6 Write property tests for card styling
    - **Property 22: Unplayable Card Styling**
    - **Property 23: Playable Card Styling**
    - **Validates: Requirements 8.2, 8.3**
  
  - [ ] 10.7 Implement active player turn indication
    - Display pulsing ring animation around active player avatar
    - _Requirements: 9.1_
  
  - [ ]* 10.8 Write property test for active player indication
    - **Property 24: Active Player Indication**
    - **Validates: Requirements 9.1**

- [ ] 11. Implement card animation system
  - [ ] 11.1 Create card animation utilities
    - Implement CSS transform-based animations
    - Create animateCardPlay() function
    - Ensure 60 FPS performance with GPU acceleration
    - _Requirements: 15.1, 15.2, 15.4_
  
  - [ ] 11.2 Implement card play animation
    - Animate card from player hand to trick area
    - Duration: 500ms
    - _Requirements: 15.1, 15.4_
  
  - [ ] 11.3 Implement trick collection animation
    - Animate all trick cards to winner's position
    - Duration: 500ms
    - _Requirements: 15.3, 15.4_
  
  - [ ] 11.4 Implement touch gesture handling
    - Handle tap events on cards
    - Handle swipe gestures for card selection
    - _Requirements: 15.5_
  
  - [ ]* 11.5 Write unit tests for animations
    - Test animation timing
    - Test animation completion callbacks
    - Test touch event handling
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 12. Implement Haptic Controller
  - [ ] 12.1 Create HapticController class
    - Check for Vibration API support
    - Implement triggerYourTurn() - single 50ms pulse
    - Implement triggerTrickWon() - double pulse pattern
    - Implement triggerTrumpDeclared() - triple pulse pattern
    - Implement triggerVictory() - celebration pattern
    - _Requirements: 2.5, 9.2, 9.3, 9.4, 16.3_
  
  - [ ]* 12.2 Write unit tests for haptic patterns
    - Test each vibration pattern
    - Test graceful degradation when API unavailable
    - _Requirements: 2.5, 9.2, 9.3, 9.4_

- [ ] 13. Implement TrumpSelector and modal components
  - [ ] 13.1 Create TrumpSelector modal component
    - Display 4 suit options to crown holder
    - Handle suit selection
    - Trigger trump declaration animation
    - _Requirements: 2.2, 2.4_
  
  - [ ] 13.2 Create RoundEndModal component
    - Display round winner and points awarded
    - Show updated scores
    - Provide "Continue" button
    - _Requirements: 16.1_
  
  - [ ] 13.3 Create VictoryModal component
    - Display winning team and final scores
    - Trigger victory haptic pattern
    - Provide "New Game" and "Return to Lobby" buttons
    - _Requirements: 16.2, 16.3, 16.4, 16.5_
  
  - [ ]* 13.4 Write unit tests for modal components
    - Test modal display logic
    - Test button interactions
    - Test data display
    - _Requirements: 2.2, 16.1, 16.2, 16.4, 16.5_

- [ ] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Implement offline game mode integration
  - [ ] 15.1 Create offline game controller
    - Initialize game state with 3 bots
    - Wire GameEngine, BotManager, and UI together
    - Handle game loop entirely in browser
    - _Requirements: 10.1, 10.4_
  
  - [ ] 15.2 Implement bot turn automation
    - Detect when bot's turn arrives
    - Call BotManager.selectCard() with 1s timeout
    - Apply bot's card play to game state
    - _Requirements: 10.2_
  
  - [ ] 15.3 Create OfflineGameView component
    - Integrate offline controller with Mobile UI
    - Display "Offline Mode" indicator
    - Provide "Return to Lobby" button
    - _Requirements: 10.1, 10.4_
  
  - [ ]* 15.4 Write integration tests for offline mode
    - Test full game flow from start to completion
    - Verify all phases transition correctly
    - Verify scoring accumulates correctly
    - Verify crown rotation works correctly
    - _Requirements: 10.1, 10.2, 10.4, 10.5_

- [ ] 16. Implement login and lobby views
  - [ ] 16.1 Create LoginView component
    - Username and password input fields
    - Login button with SessionManager integration
    - Registration link
    - _Requirements: 12.1, 13.1_
  
  - [ ] 16.2 Create LobbyView component
    - Display user statistics (if logged in)
    - "Create Game" button (if logged in)
    - "Join Game" button (if logged in)
    - "Play Offline" button (always available)
    - Logout button (if logged in)
    - _Requirements: 12.1_
  
  - [ ]* 16.3 Write unit tests for login and lobby
    - Test login form submission
    - Test navigation to offline game
    - Test offline mode launch without authentication
    - _Requirements: 12.1, 12.2, 12.3, 13.1_

- [ ] 17. Checkpoint - Ensure offline play is fully functional
  - Test complete offline game flow from lobby to victory
  - Verify all game rules work correctly
  - Verify UI responsiveness and animations
  - Ask the user if they want to proceed with online multiplayer

- [ ] 18. Implement Session Manager
  - [ ] 18.1 Create SessionManager class
    - Implement login() function with token creation
    - Implement logout() function with token clearing
    - Implement getSession() to retrieve from localStorage
    - Implement isAuthenticated() check
    - _Requirements: 13.1, 13.2, 13.3, 13.5_
  
  - [ ]* 18.2 Write property test for session token expiration
    - **Property 28: Session Token Expiration**
    - **Validates: Requirements 13.2**
  
  - [ ]* 18.3 Write property test for expired token redirect
    - **Property 29: Expired Token Redirect**
    - **Validates: Requirements 13.4**
  
  - [ ]* 18.4 Write unit tests for session management
    - Test token creation and storage
    - Test auto-authentication on app load
    - Test logout functionality
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 19. Implement LokiJS persistence layer
  - [ ] 19.1 Set up LokiJS database
    - Create users collection
    - Create games collection
    - Create statistics collection
    - Configure auto-save every 5 minutes
    - Configure load on startup
    - _Requirements: 14.1, 14.3, 14.4_
  
  - [ ] 19.2 Implement user authentication with LokiJS
    - Create user registration function
    - Create user login function with password hashing
    - Integrate with SessionManager
    - _Requirements: 13.1_
  
  - [ ] 19.3 Implement game result persistence
    - Save game record on completion
    - Store player IDs, winner, scores, rounds, timestamp
    - _Requirements: 14.2_
  
  - [ ]* 19.4 Write property test for game result persistence
    - **Property 30: Game Result Persistence**
    - **Validates: Requirements 14.2**
  
  - [ ] 19.5 Implement statistics tracking
    - Update games played count
    - Update games won count
    - Update total points scored
    - Calculate average points per game
    - _Requirements: 14.5_
  
  - [ ]* 19.6 Write property test for statistics update
    - **Property 31: Statistics Update**
    - **Validates: Requirements 14.5**
  
  - [ ]* 19.7 Write unit tests for persistence layer
    - Test user CRUD operations
    - Test game record creation
    - Test statistics calculations
    - Test auto-save and load
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 21. Implement Colyseus server with CrownRoom
  - [ ] 21.1 Set up Colyseus server with ElysiaJS
    - Initialize Colyseus server
    - Configure WebSocket transport
    - Register CrownRoom
    - _Requirements: 11.1, 11.6_
  
  - [ ] 21.2 Implement CrownRoom class
    - Implement onCreate() - initialize game state
    - Implement onJoin() - add player to game
    - Implement onLeave() - handle disconnection
    - Implement onDispose() - cleanup
    - _Requirements: 11.1_
  
  - [ ] 21.3 Implement declareTrump command with validation
    - Validate player is crown holder
    - Validate game phase is TRUMP_DECLARATION
    - Apply trump declaration to state
    - Broadcast state update
    - _Requirements: 11.2_
  
  - [ ] 21.4 Implement playCard command with validation
    - Validate it's player's turn
    - Validate card is in player's hand
    - Validate card can be played (suit following)
    - Apply card play to state
    - Broadcast state update
    - _Requirements: 11.2_
  
  - [ ]* 21.5 Write property test for server action validation
    - **Property 26: Server Action Validation**
    - **Validates: Requirements 11.2**
  
  - [ ] 21.6 Implement state synchronization
    - Broadcast state updates within 100ms
    - Send full state on player join
    - _Requirements: 11.3_
  
  - [ ] 21.7 Implement reconnection handling
    - Pause game on player disconnect
    - Wait 60 seconds for reconnection
    - Resume game on reconnection
    - Replace with bot after timeout
    - _Requirements: 11.4, 11.5_
  
  - [ ]* 21.8 Write unit tests for Colyseus server
    - Test room creation and joining
    - Test action validation
    - Test state broadcasting
    - Test reconnection logic
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 22. Implement online multiplayer client integration
  - [ ] 22.1 Create Colyseus client wrapper
    - Connect to Colyseus server via WebSocket
    - Handle connection state changes
    - Send actions to server
    - Receive state updates from server
    - _Requirements: 11.1, 11.3_
  
  - [ ] 22.2 Implement online game controller
    - Initialize connection to game room
    - Send declareTrump action to server
    - Send playCard action to server
    - Update UI on state changes from server
    - _Requirements: 11.2, 11.3_
  
  - [ ] 22.3 Implement reconnection UI
    - Display reconnection indicator on disconnect
    - Show countdown timer (60s)
    - Restore game state on reconnection
    - _Requirements: 11.4, 19.1, 19.2_
  
  - [ ]* 22.4 Write integration tests for online mode
    - Test full multiplayer game with 4 connected clients
    - Verify state synchronization across all clients
    - Verify reconnection handling
    - Verify bot replacement on timeout
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 23. Implement headless testing script
  - [ ] 23.1 Create headless test script
    - Simulate 3 bot players joining room
    - Run full game to completion
    - Verify game rules enforced by server
    - Target completion time < 10 seconds
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_
  
  - [ ]* 23.2 Write integration test using headless script
    - Test server processes game correctly
    - Test all phases transition
    - Test scoring and crown rotation
    - _Requirements: 17.2, 17.3, 17.4_

- [ ] 24. Implement error handling and recovery
  - [ ] 24.1 Implement client-side error handling
    - Add global error boundary
    - Handle network errors with retry logic
    - Handle invalid state errors
    - Display user-friendly error messages
    - _Requirements: 19.1, 19.2, 19.4_
  
  - [ ] 24.2 Implement server-side error handling
    - Validate game state invariants
    - Handle database errors with retry
    - Log all errors with context
    - _Requirements: 19.3_
  
  - [ ] 24.3 Implement error reporting
    - Create error report interface
    - Capture error details (stack, state, context)
    - Provide "Report Issue" button
    - _Requirements: 19.5_
  
  - [ ]* 24.4 Write unit tests for error handling
    - Test network error recovery
    - Test state validation
    - Test error reporting
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [ ] 25. Implement performance optimizations
  - [ ] 25.1 Optimize initial load time
    - Code splitting for routes
    - Lazy load non-critical components
    - Compress assets
    - Target < 2s on 3G connection
    - _Requirements: 18.1, 18.4_
  
  - [ ] 25.2 Optimize card play response time
    - Debounce touch events
    - Optimize state updates
    - Target < 100ms response
    - _Requirements: 18.2_
  
  - [ ] 25.3 Optimize animation performance
    - Use CSS transforms for GPU acceleration
    - Reduce layout thrashing
    - Target 60 FPS
    - _Requirements: 18.3_
  
  - [ ] 25.4 Optimize game engine performance
    - Profile trick resolution logic
    - Optimize card validation
    - Target < 50ms processing time
    - _Requirements: 18.5_
  
  - [ ]* 25.5 Write performance tests
    - Test initial load time
    - Test card play response time
    - Test animation frame rate
    - Test bundle size
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 26. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 27. Set up deployment configuration
  - [ ] 27.1 Create Dockerfile for Render deployment
    - Use Bun as base image
    - Copy source files
    - Install dependencies
    - Expose WebSocket port
    - _Requirements: 20.1, 20.4_
  
  - [ ] 27.2 Configure LokiJS persistence for ephemeral filesystem
    - Set up periodic backups
    - Configure external volume mounting
    - Implement restore on startup
    - _Requirements: 20.2_
  
  - [ ] 27.3 Configure static file serving
    - Serve PWA assets from same Render instance
    - Configure HTTPS
    - _Requirements: 20.3_
  
  - [ ] 27.4 Configure automatic restart on crash
    - Set up health check endpoint
    - Configure restart policy
    - _Requirements: 20.5_
  
  - [ ]* 27.5 Write deployment verification tests
    - Test Docker build succeeds
    - Test server starts correctly
    - Test static files served
    - _Requirements: 20.1, 20.3, 20.4, 20.5_

- [ ] 28. Create E2E tests for mobile UI
  - [ ]* 28.1 Set up Playwright with mobile viewport
    - Configure 375x667 viewport
    - Set up touch event simulation
    - _Requirements: 18.1_
  
  - [ ]* 28.2 Write E2E tests for offline game flow
    - Test offline game creation
    - Test card play interactions
    - Test trump declaration
    - Test round completion
    - _Requirements: 6.3, 8.1, 15.5_
  
  - [ ]* 28.3 Write E2E tests for online game flow
    - Test online game creation
    - Test multiplayer card play
    - Test reconnection flow
    - _Requirements: 11.1, 11.3, 11.4_
  
  - [ ]* 28.4 Write E2E tests for PWA installation
    - Test manifest.json served correctly
    - Test standalone mode launch
    - _Requirements: 6.1, 6.2_
  
  - [ ]* 28.5 Write E2E tests for navigation
    - Test route transitions
    - Test authentication guard
    - Test back button navigation
    - _Requirements: 12.2, 12.3, 12.4, 12.5_

- [ ] 29. Final integration and polish
  - [ ] 29.1 Integrate all components into complete application
    - Wire offline mode with UI
    - Wire online mode with UI
    - Connect login/lobby/game views
    - Test full user journey
    - _Requirements: All_
  
  - [ ] 29.2 Add Tailwind styling and DaisyUI components
    - Style all UI components
    - Ensure mobile-first responsive design
    - Apply theme colors
    - _Requirements: 6.3, 6.4_
  
  - [ ] 29.3 Test cross-browser compatibility
    - Test on Chrome Mobile
    - Test on Safari iOS
    - Test on Firefox Mobile
    - _Requirements: 18.1, 18.2, 18.3_
  
  - [ ]* 29.4 Run full test suite
    - Run all unit tests
    - Run all property tests (32 properties)
    - Run all integration tests
    - Run all E2E tests
    - Verify 100% property test coverage
    - _Requirements: All_

- [ ] 30. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, verify deployment readiness, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- All 32 correctness properties have corresponding property tests (31 original + 1 re-deal property)
- Property tests use fast-check with minimum 100 iterations
- Checkpoints ensure incremental validation at key milestones
- **NEW WORKFLOW**: Implementation now prioritizes offline play testing before online multiplayer
- Implementation follows phased approach: Core Engine → PWA Shell → Mobile UI → Offline Mode → Login/Lobby → Session/Persistence → Online Mode → Deployment
- Testing strategy combines unit tests (specific examples) with property tests (universal correctness)
- Task 17 is a critical checkpoint to test offline play before proceeding with online features
