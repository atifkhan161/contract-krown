# Requirements Document: Contract Crown Game

## Introduction

Contract Crown is a mobile-only Progressive Web App (PWA) implementing a real-time 4-player trick-taking card game. Two fixed partnerships compete to reach 52 points using a 32-card deck with a two-phase dealing system and a "Crown Rule" for declaration privilege. The system supports both offline bot practice and online multiplayer gameplay with server-authoritative state management.

## Glossary

- **Game_Engine**: Core logic module handling card shuffling, ranking, trick resolution, and scoring
- **PWA_Shell**: Progressive Web App infrastructure including manifest and standalone mode
- **Mobile_UI**: Portrait-first user interface optimized for thumb-zone interaction
- **Bot_Manager**: Local AI opponent system for offline single-player practice
- **Crown_Holder**: The player with declaration privilege for the current round
- **Declaring_Team**: The partnership containing the Crown_Holder
- **Challenging_Team**: The partnership opposing the Declaring_Team
- **Trick**: A set of 4 cards played in sequence, one per player
- **Trump_Suit**: The suit declared by the Crown_Holder that ranks highest in trick resolution
- **Felt_Grid**: The visual layout showing partner (top), opponents (left/right), user (bottom), and trick center
- **Playability_State**: The determination of whether a card can be legally played based on game rules
- **Session_Manager**: Component handling user authentication and session persistence
- **Haptic_Controller**: Component managing device vibration feedback

## Requirements

### Requirement 1: Game Initialization and Deck Management

**User Story:** As a player, I want the game to properly initialize with a 32-card deck, so that each round starts with the correct cards.

#### Acceptance Criteria

1. THE Game_Engine SHALL create a deck containing exactly 32 cards with ranks 7, 8, 9, 10, J, Q, K, A in all four suits
2. WHEN a new round begins, THE Game_Engine SHALL shuffle the deck using a cryptographically secure random algorithm
3. THE Game_Engine SHALL deal exactly 4 cards to each of the 4 players in the initial phase
4. WHEN trump declaration is complete, THE Game_Engine SHALL deal exactly 4 additional cards to each player
5. THE Game_Engine SHALL verify that each player receives exactly 8 cards total before trick play begins
6. WHEN any player receives 3 or more Aces OR 3 or more Sevens in their 8-card hand, THE Game_Engine SHALL invalidate the deal and re-shuffle and re-deal all 8 cards to all 4 players

### Requirement 2: Trump Declaration Process

**User Story:** As the Crown Holder, I want to declare trump after seeing my first 4 cards, so that I can influence the round strategy.

#### Acceptance Criteria

1. WHEN the initial 4-card deal is complete, THE Game_Engine SHALL identify the Crown_Holder
2. THE Mobile_UI SHALL display the 4 trump suit options to the Crown_Holder
3. WHEN the Crown_Holder selects a suit, THE Game_Engine SHALL set that suit as the Trump_Suit for the current round
4. WHEN trump is declared, THE Mobile_UI SHALL display a center-screen animation showing the Trump_Suit
5. WHEN trump is declared, THE Haptic_Controller SHALL trigger a short vibration pulse

### Requirement 3: Trick-Taking Gameplay

**User Story:** As a player, I want to play cards according to trick-taking rules, so that the game follows standard card game conventions.

#### Acceptance Criteria

1. THE Game_Engine SHALL designate the player left of the dealer as the lead player for the first trick
2. WHEN a trick is in progress, THE Game_Engine SHALL enforce turn order proceeding clockwise
3. WHEN a player leads a trick, THE Game_Engine SHALL allow that player to play any card from their hand
4. WHEN a player follows in a trick, THE Game_Engine SHALL require the player to follow the led suit if they possess cards of that suit
5. WHEN a player cannot follow suit, THE Game_Engine SHALL allow the player to play any card from their hand
6. WHEN all 4 players have played to a trick, THE Game_Engine SHALL determine the winner using trump and rank precedence
7. THE Game_Engine SHALL award the trick to the player who played the highest trump card, or if no trump was played, the highest card of the led suit
8. WHEN a trick is won, THE Game_Engine SHALL designate the winner as the lead player for the next trick

### Requirement 4: Crown Rule Implementation

**User Story:** As a player, I want the Crown to pass based on trick performance, so that declaration privilege is earned through gameplay.

#### Acceptance Criteria

1. WHEN a round ends and the Declaring_Team has won 5 or more tricks, THE Game_Engine SHALL retain the Crown_Holder for the next round
2. WHEN a round ends and the Declaring_Team has won fewer than 5 tricks, THE Game_Engine SHALL pass the Crown clockwise to the next player
3. THE Game_Engine SHALL rotate the dealer role clockwise every round regardless of Crown_Holder status
4. THE Mobile_UI SHALL display a visual indicator showing which player is the current Crown_Holder

### Requirement 5: Winner-Takes-All Scoring

**User Story:** As a player, I want scoring to follow the winner-takes-all system, so that only the winning team receives points each round.

#### Acceptance Criteria

1. WHEN a round ends and the Declaring_Team has won T tricks where T is greater than or equal to 5, THE Game_Engine SHALL award T points to the Declaring_Team
2. WHEN a round ends and the Declaring_Team has won fewer than 5 tricks, THE Game_Engine SHALL award the number of tricks won by the Challenging_Team as points to the Challenging_Team
3. THE Game_Engine SHALL maintain cumulative scores for both teams across all rounds
4. WHEN either team reaches or exceeds 52 points, THE Game_Engine SHALL declare that team the winner and end the game
5. THE Mobile_UI SHALL display current team scores in the header area at all times

### Requirement 6: Mobile-First PWA Infrastructure

**User Story:** As a mobile user, I want the game to install as a PWA, so that I have a native app-like experience.

#### Acceptance Criteria

1. THE PWA_Shell SHALL provide a manifest.json file with app name, icons, and display mode set to standalone
2. WHEN the user adds the app to their home screen, THE PWA_Shell SHALL launch in standalone mode without browser UI
3. THE Mobile_UI SHALL use a portrait-first layout optimized for mobile devices
4. THE Mobile_UI SHALL position all primary interactive elements within the bottom 30% of the screen for thumb-zone accessibility

### Requirement 7: Felt Grid Layout

**User Story:** As a player, I want to see all players and the trick area clearly, so that I can follow the game state.

#### Acceptance Criteria

1. THE Mobile_UI SHALL display the partner avatar and card count at the top of the screen
2. THE Mobile_UI SHALL display opponent avatars on the left and right sides of the screen
3. THE Mobile_UI SHALL display the user's interactive hand at the bottom of the screen
4. THE Mobile_UI SHALL display the active trick area in the center of the screen
5. THE Mobile_UI SHALL display the Trump_Suit, Crown_Holder indicator, and team scores within the grid layout corners to maximize screen space for gameplay

### Requirement 8: Card Playability Indication

**User Story:** As a player, I want to see which cards I can legally play, so that I don't attempt invalid moves.

#### Acceptance Criteria

1. WHEN it is the user's turn, THE Mobile_UI SHALL calculate the Playability_State for each card in the user's hand
2. WHEN a card cannot be legally played, THE Mobile_UI SHALL dim that card and make it unclickable
3. WHEN a card can be legally played, THE Mobile_UI SHALL display that card at full brightness and make it clickable
4. WHEN the user is leading a trick, THE Mobile_UI SHALL mark all cards in the user's hand as playable

### Requirement 9: Turn Indication and Haptic Feedback

**User Story:** As a player, I want clear feedback about whose turn it is, so that I know when to act.

#### Acceptance Criteria

1. WHEN it is a player's turn, THE Mobile_UI SHALL display a pulsing ring animation around that player's avatar
2. WHEN it becomes the user's turn, THE Haptic_Controller SHALL trigger a short vibration pulse
3. WHEN the user wins a trick, THE Haptic_Controller SHALL trigger a short vibration pulse
4. WHEN the game or round ends, THE Haptic_Controller SHALL trigger a victory vibration pattern

### Requirement 10: Offline Bot Practice Mode

**User Story:** As a solo developer or player, I want to play against AI bots offline, so that I can practice without requiring other players.

#### Acceptance Criteria

1. THE Bot_Manager SHALL provide 3 AI opponents for local single-player games
2. WHEN a bot's turn arrives, THE Bot_Manager SHALL select a legal card to play within 1 second
3. THE Bot_Manager SHALL follow all game rules including suit-following requirements
4. WHERE offline mode is active, THE Game_Engine SHALL run entirely in the browser without server communication
5. THE Bot_Manager SHALL implement basic strategy including trump usage and suit-following logic

### Requirement 11: Online Multiplayer with Colyseus

**User Story:** As a player, I want to play with other real players online, so that I can enjoy competitive multiplayer gameplay.

#### Acceptance Criteria

1. THE Colyseus_Server SHALL maintain authoritative game state for all online matches
2. WHEN a player performs an action, THE Colyseus_Server SHALL validate the action before applying state changes
3. THE Colyseus_Server SHALL broadcast state updates to all connected clients within 100 milliseconds
4. WHEN a player disconnects, THE Colyseus_Server SHALL pause the game and wait for reconnection for up to 60 seconds
5. WHEN a player fails to reconnect within 60 seconds, THE Colyseus_Server SHALL replace that player with a bot
6. THE Colyseus_Server SHALL support multiple concurrent game rooms

### Requirement 12: Client-Side Routing

**User Story:** As a user, I want to navigate between login, lobby, and game screens, so that I can access different parts of the application.

#### Acceptance Criteria

1. THE PWA_Shell SHALL implement client-side routing using Page.js
2. THE PWA_Shell SHALL provide routes for /login, /lobby, and /game paths
3. WHEN a user navigates to a route, THE PWA_Shell SHALL render the corresponding view without full page reload
4. WHEN a user is not authenticated, THE PWA_Shell SHALL redirect navigation attempts to /lobby or /game to /login
5. THE PWA_Shell SHALL maintain browser history for back button navigation

### Requirement 13: User Authentication and Session Management

**User Story:** As a user, I want to stay logged in on my mobile device, so that I don't have to re-authenticate frequently.

#### Acceptance Criteria

1. THE Session_Manager SHALL store user session tokens in localStorage
2. WHEN a user successfully authenticates, THE Session_Manager SHALL create a session token valid for 30 days
3. WHEN the app loads, THE Session_Manager SHALL check for a valid session token and auto-authenticate if present
4. WHEN a session token expires, THE Session_Manager SHALL redirect the user to the login screen
5. THE Session_Manager SHALL provide a logout function that clears the session token from localStorage

### Requirement 14: User Data Persistence

**User Story:** As a player, I want my game history and statistics to be saved, so that I can track my progress over time.

#### Acceptance Criteria

1. THE Colyseus_Server SHALL use LokiJS to store user profiles, game history, and statistics
2. WHEN a game completes, THE Colyseus_Server SHALL persist the game result to the database
3. THE Colyseus_Server SHALL persist the database to a JSON file every 5 minutes
4. WHEN the server restarts, THE Colyseus_Server SHALL load user data from the persisted JSON file
5. THE Colyseus_Server SHALL maintain statistics including games played, games won, and total points scored per user

### Requirement 15: Card Animation System

**User Story:** As a player, I want smooth card animations, so that the game feels polished and responsive.

#### Acceptance Criteria

1. WHEN a card is played, THE Mobile_UI SHALL animate the card from the player's hand to the trick area
2. THE Mobile_UI SHALL use CSS transforms for card animations to ensure 60 FPS performance
3. WHEN a trick is won, THE Mobile_UI SHALL animate all trick cards moving to the winner's position
4. THE Mobile_UI SHALL complete all card animations within 500 milliseconds
5. THE Mobile_UI SHALL support touch gestures for card selection and playing

### Requirement 16: Victory and Round Completion

**User Story:** As a player, I want clear feedback when a round or game ends, so that I understand the outcome.

#### Acceptance Criteria

1. WHEN a round ends, THE Mobile_UI SHALL display a modal showing the round winner and points awarded
2. WHEN a game ends, THE Mobile_UI SHALL display a victory modal showing the winning team and final scores
3. WHEN a victory modal is displayed, THE Haptic_Controller SHALL trigger a victory vibration pattern
4. THE Mobile_UI SHALL provide a button to start a new game from the victory modal
5. THE Mobile_UI SHALL provide a button to return to the lobby from the victory modal

### Requirement 17: Headless Testing Support

**User Story:** As a developer, I want to test multiplayer functionality without manual player coordination, so that I can verify server behavior efficiently.

#### Acceptance Criteria

1. THE Colyseus_Server SHALL support headless client connections for automated testing
2. THE Game_Engine SHALL provide a test script that simulates 3 bot players joining a game room
3. WHEN the test script runs, THE Colyseus_Server SHALL process the simulated game to completion
4. THE test script SHALL verify that game rules are correctly enforced by the server
5. THE test script SHALL complete a full game simulation in under 10 seconds

### Requirement 18: Performance and Responsiveness

**User Story:** As a mobile user, I want the game to load quickly and respond instantly, so that I have a smooth gaming experience.

#### Acceptance Criteria

1. THE PWA_Shell SHALL load the initial UI within 2 seconds on a 3G mobile connection
2. WHEN a user taps a playable card, THE Mobile_UI SHALL respond within 100 milliseconds
3. THE Mobile_UI SHALL maintain 60 FPS during all animations and transitions
4. THE PWA_Shell SHALL limit the total app size including assets to under 5 MB
5. THE Game_Engine SHALL process trick resolution logic within 50 milliseconds

### Requirement 19: Error Handling and Recovery

**User Story:** As a player, I want the game to handle errors gracefully, so that temporary issues don't ruin my experience.

#### Acceptance Criteria

1. WHEN a network error occurs during online play, THE PWA_Shell SHALL display a reconnection indicator
2. WHEN connection is restored, THE Colyseus_Server SHALL synchronize the client to the current game state
3. IF the Colyseus_Server detects an invalid game state, THEN THE Colyseus_Server SHALL log the error and reset the game room
4. WHEN a client-side error occurs, THE PWA_Shell SHALL log the error and display a user-friendly error message
5. THE PWA_Shell SHALL provide a "Report Issue" button in error messages that captures error details

### Requirement 21: Re-Deal on Extreme Hand Condition

**User Story:** As a player, I want the game to re-deal if any player receives an extremely unbalanced hand, so that the game remains fair and playable.

#### Acceptance Criteria

1. WHEN the final dealing phase is complete, THE Game_Engine SHALL check each player's hand for 3 or more Aces
2. WHEN the final dealing phase is complete, THE Game_Engine SHALL check each player's hand for 3 or more Sevens
3. IF any player has 3 or more Aces OR 3 or more Sevens, THE Game_Engine SHALL invalidate the current deal
4. WHEN a deal is invalidated, THE Game_Engine SHALL re-shuffle the deck and re-deal all 8 cards to all 4 players
5. WHEN a re-deal occurs, THE Game_Engine SHALL repeat the re-deal check until a valid deal is achieved
6. THE Mobile_UI SHALL display a "Re-dealing..." message when a re-deal is triggered

### Requirement 20: Deployment and Infrastructure

**User Story:** As a developer, I want to deploy the game on free infrastructure, so that I can operate with zero budget.

#### Acceptance Criteria

1. THE Colyseus_Server SHALL run on Render's free tier using Docker containerization
2. THE Colyseus_Server SHALL handle the ephemeral file system by persisting LokiJS data to an external volume or periodic backups
3. THE PWA_Shell SHALL be served as static files from the same Render instance
4. THE Colyseus_Server SHALL use Bun as the runtime for optimal performance
5. THE deployment configuration SHALL support automatic restarts on crashes
