# Graph Report - contract-krown  (2026-04-27)

## Corpus Check
- 89 files · ~171,819 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 800 nodes · 1547 edges · 27 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 290 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]

## God Nodes (most connected - your core abstractions)
1. `OnlineGameController` - 41 edges
2. `CrownRoom` - 33 edges
3. `GameView` - 32 edges
4. `CrownServer` - 31 edges
5. `CrownServer` - 31 edges
6. `FeltGrid` - 28 edges
7. `PartyKitClientWrapper` - 23 edges
8. `TeamMemory` - 22 edges
9. `OfflineGameController` - 21 edges
10. `CardProbability` - 18 edges

## Surprising Connections (you probably didn't know these)
- `pickBestCard()` --calls--> `readPlayableCards()`  [INFERRED]
  tests/e2e/helpers/smart-bot-adapter.ts → tests/e2e/helpers/game-state-reader.ts
- `pickBestCard()` --calls--> `buildGameStateFromDOM()`  [INFERRED]
  tests/e2e/helpers/smart-bot-adapter.ts → tests/e2e/helpers/game-state-reader.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (8): computeHash(), processFiles(), updateHtml(), OnlineGameController, PartyKitClientWrapper, connectPlayer(), createRoomAsAdmin(), playCardForPlayer()

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (4): App, getPlayerPosition(), ContextMenu, GameView

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (5): JoinRoomModal, ModalBottomSheet, RoundEndModal, TrumpSelector, VictoryModal

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (3): getElementPosition(), getTrickAreaPosition(), ReconnectionOverlay

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (19): advanceTurn(), calculateScore(), canPlayCard(), checkForExtremeHand(), countTricksByTeam(), createDeck(), createPlayers(), dealFinal() (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (6): CrownRoom, joinFourPlayers(), makeMockConnection(), declareTrump(), setFirstTrickLeader(), RoomRegistry

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (19): generateMockUserId(), isLoggedIn(), joinGameRoom(), loginUser(), buildGameStateFromDOM(), cardValue(), isRoundEndModalVisible(), isTrumpSelectorVisible() (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (4): SmartBot, cardKey(), createFullDeck(), TeamMemory

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (4): BotManager, CrownServer, pickBestTrumpSuit(), resetBotMemories()

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (2): FeltGrid, GameMenu

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (3): LoginView, RegistrationView, WaitingRoomView

### Community 11 - "Community 11"
Cohesion: 0.1
Nodes (3): createInitialState(), HapticController, OfflineGameController

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (4): LobbyView, Router, SessionManager, ThemeManager

### Community 13 - "Community 13"
Cohesion: 0.1
Nodes (1): SupabaseService

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (2): TouchGestureHandler, OfflineGameView

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (1): CardProbability

### Community 16 - "Community 16"
Cohesion: 0.26
Nodes (1): GameHeader

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (1): AppHeader

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (1): RoomCodeGenerator

### Community 21 - "Community 21"
Cohesion: 0.4
Nodes (1): GameManager

### Community 22 - "Community 22"
Cohesion: 0.5
Nodes (1): CardDisplay

### Community 23 - "Community 23"
Cohesion: 0.5
Nodes (1): UserManager

### Community 24 - "Community 24"
Cohesion: 0.5
Nodes (1): AuthManager

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (1): Trick-Taking Game Logic

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (1): Team Memory Pattern

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (1): Bot AI Pattern

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (1): 32-Card Deck System

## Knowledge Gaps
- **Thin community `Community 9`** (38 nodes): `FeltGrid`, `.clearDisplays()`, `.constructor()`, `.createElements()`, `.getCardPosition()`, `.getContainer()`, `.getCrownHolderName()`, `.getPlayerLabel()`, `.getRankDisplay()`, `.getSuitColor()`, `.getSuitSymbol()`, `.hideReDealingMessage()`, `.render()`, `.renderBottomLeft()`, `.renderBottomRight()`, `.renderCard()`, `.renderOpponentDisplays()`, `.renderPartnerDisplay()`, `.renderSingleOpponent()`, `.renderTopLeft()`, `.renderTopRight()`, `.renderTrickDisplayBuffer()`, `.renderUserHand()`, `.updateActivePlayer()`, `.updatePlayerActiveState()`, `GameMenu`, `.constructor()`, `.destroy()`, `.getContainer()`, `.getCurrentUserPlayerIndex()`, `.getPlayedCardsForUserTeam()`, `.getSuitSymbol()`, `.renderPlayedCardsContent()`, `.setContainer()`, `.setupModalEventListeners()`, `.showPlayedCardsModal()`, `.addCardToTrickDisplay()`, `.hideReDealing()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (24 nodes): `.onRequest()`, `corsResponse()`, `generateRoomCode()`, `generateRoomId()`, `getContentType()`, `jsonResponse()`, `loadStaticAsset()`, `.onRequest()`, `party-server.ts`, `room-registry.ts`, `supabase.ts`, `SupabaseService`, `.constructor()`, `.getAnonKey()`, `.getClient()`, `.getInstance()`, `.getProfile()`, `.getUrl()`, `.getUser()`, `.resetPasswordForEmail()`, `.signIn()`, `.signOut()`, `.signUp()`, `.updatePassword()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (23 nodes): `TouchGestureHandler`, `.constructor()`, `.destroy()`, `.handleClick()`, `.handleTouchEnd()`, `.handleTouchStart()`, `.setupEventListeners()`, `.setupSwipeHandler()`, `.triggerCardTap()`, `.stop()`, `OfflineGameView`, `.constructor()`, `.createElements()`, `.destroy()`, `.getContainer()`, `.getController()`, `.handleReturnToLobby()`, `.hideOfflineIndicator()`, `.setReturnToLobbyHandler()`, `.showOfflineIndicator()`, `.startGame()`, `.update()`, `.stop()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (18 nodes): `CardProbability`, `.calculateLeadWinProbability()`, `.calculateWinProbabilities()`, `.calculateWinProbability()`, `.cardKey()`, `.clone()`, `.constructor()`, `.estimatePlayerHand()`, `.getUnaccountedBySuit()`, `.getUnaccountedCards()`, `.getUnaccountedTrumpCount()`, `.isCardBetter()`, `.isOpponentVoid()`, `.rankValue()`, `.recordPlay()`, `.recordTrickWin()`, `.setTrumpSuit()`, `card-probability.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (13 nodes): `GameHeader`, `.constructor()`, `.createElements()`, `.getContainer()`, `.getCrownHolderDisplay()`, `.getScoresDisplay()`, `.getSuitColor()`, `.getTrumpSuitDisplay()`, `.render()`, `.updateCrownHolder()`, `.updateScore()`, `.updateTrumpSuit()`, `game-header.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (9 nodes): `AppHeader`, `.constructor()`, `.createElements()`, `.defaultBack()`, `.destroy()`, `.getContainer()`, `.hide()`, `.setBackHandler()`, `.show()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (8 nodes): `RoomCodeGenerator`, `.generate()`, `.getRoomId()`, `.randomCode()`, `.register()`, `.removeCode()`, `room-code-generator.ts`, `room-code-properties.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (5 nodes): `GameManager`, `.createGame()`, `.deleteGame()`, `.getGame()`, `games.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (4 nodes): `CardDisplay`, `.renderCard()`, `.renderHand()`, `card-display.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (4 nodes): `users.ts`, `UserManager`, `.createUser()`, `.getUser()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (4 nodes): `AuthManager`, `.createToken()`, `.validateToken()`, `auth.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `Trick-Taking Game Logic`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `Team Memory Pattern`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `Bot AI Pattern`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `32-Card Deck System`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `OnlineGameController` connect `Community 0` to `Community 11`, `Community 1`, `Community 3`, `Community 14`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `GameView` connect `Community 1` to `Community 0`, `Community 3`, `Community 9`, `Community 11`, `Community 12`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `CrownRoom` connect `Community 5` to `Community 3`, `Community 4`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._