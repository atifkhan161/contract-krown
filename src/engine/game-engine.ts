// Contract Crown Game Engine
// Core game logic implementation

import { Card, GameState, Player, Suit, Rank, GamePhase, Trick, PlayedCard } from './types.js';

// Rank values for comparison (higher = stronger)
const RANK_VALUES: Record<Rank, number> = {
  '7': 0,
  '8': 1,
  '9': 2,
  '10': 3,
  'J': 4,
  'Q': 5,
  'K': 6,
  'A': 7
};

/**
 * Creates a 32-card deck with ranks 7, 8, 9, 10, J, Q, K, A in all four suits
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  const suits: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
  const ranks: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }

  return deck;
}

/**
 * Shuffles a deck using Web Crypto API for cryptographically secure randomness
 * Optionally accepts a custom random generator for testing
 */
export function shuffle(deck: Card[], randomFn?: (max: number) => number): Card[] {
  const shuffled = [...deck];

  // Use provided random function or default to crypto.getRandomValues
  const getRandomValue = randomFn || ((max: number) => {
    if (typeof window === 'undefined' || !window.crypto) {
      // Fallback for non-browser environments (like tests)
      return Math.floor(Math.random() * max);
    }
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
  });

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = getRandomValue(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Creates a new game state with initial setup
 */
export function createInitialState(): GameState {
  return {
    deck: [],
    players: [],
    currentTrick: { leadPlayer: 0, cards: [], winner: null },
    completedTricks: [],
    trumpSuit: null,
    crownHolder: 0,
    dealer: 0,
    phase: 'DEALING_INITIAL',
    scores: [0, 0],
    currentPlayer: 0
  };
}

/**
 * Creates players with fixed partnerships
 * Team 0: players 0 & 2
 * Team 1: players 1 & 3
 */
export function createPlayers(playerCount: number = 4): Player[] {
  const players: Player[] = [];

  for (let i = 0; i < playerCount; i++) {
    players.push({
      id: i,
      hand: [],
      team: i % 2 === 0 ? 0 : 1,
      isBot: i > 0
    });
  }

  return players;
}

/**
 * Creates a deterministic random number generator for testing
 */
export function createDeterministicRandom(seed: number): (max: number) => number {
  return (max: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % max;
  };
}

/**
 * Deals initial 4 cards to each player
 */
export function dealInitial(state: GameState): void {
  // Create and shuffle deck
  state.deck = shuffle(createDeck());
  state.players = createPlayers();

  // Deal 4 cards to each player
  for (let i = 0; i < 4; i++) {
    for (const player of state.players) {
      player.hand.push(state.deck.pop()!);
    }
  }

  // Set crown holder to player left of dealer
  state.crownHolder = (state.dealer + 1) % 4;
  state.currentPlayer = state.crownHolder;
  state.phase = 'TRUMP_DECLARATION';
}

/**
 * Deals final 4 cards to each player
 */
export function dealFinal(state: GameState): void {
  // Deal 4 more cards to each player
  for (let i = 0; i < 4; i++) {
    for (const player of state.players) {
      player.hand.push(state.deck.pop()!);
    }
  }

  state.phase = 'TRICK_PLAY';
}

/**
 * Checks if a deal is valid (no player has 3+ Aces or 3+ Sevens)
 */
export function validateDeal(state: GameState): boolean {
  return !checkForExtremeHand(state);
}

/**
 * Checks if any player has 3 or more Aces or 3 or more Sevens
 */
export function checkForExtremeHand(state: GameState): boolean {
  for (const player of state.players) {
    const aces = player.hand.filter(c => c.rank === 'A').length;
    const sevens = player.hand.filter(c => c.rank === '7').length;

    if (aces >= 3 || sevens >= 3) {
      return true;
    }
  }

  return false;
}

/**
 * Validates a deal and re-deals if extreme hand condition is detected
 * Returns true if deal is valid, false if re-deal occurred
 */
export function validateAndDeal(state: GameState): boolean {
  // Deal initial 4 cards
  dealInitial(state);

  // Check for extreme hand and re-deal if needed
  while (!validateDeal(state)) {
    // Re-deal from scratch
    state.deck = shuffle(createDeck());
    state.players = createPlayers();

    for (let i = 0; i < 4; i++) {
      for (const player of state.players) {
        player.hand.push(state.deck.pop()!);
      }
    }
  }

  // Deal final 4 cards
  dealFinal(state);

  // Check again after final deal
  while (!validateDeal(state)) {
    // Re-deal from scratch
    state.deck = shuffle(createDeck());
    state.players = createPlayers();

    // Deal initial 4 cards
    for (let i = 0; i < 4; i++) {
      for (const player of state.players) {
        player.hand.push(state.deck.pop()!);
      }
    }

    // Check extreme hand after initial deal
    if (!validateDeal(state)) {
      continue; // Re-deal again
    }

    // Deal final 4 cards
    dealFinal(state);
  }

  return true;
}

/**
 * Validates and applies trump declaration
 * - Checks that the caller is the current crown holder
 * - Checks that the game phase allows trump declaration
 * - Updates the game state with the selected trump suit
 */
export function declareTrump(state: GameState, suit: Suit): void {
  // Validate caller is the crown holder
  if (state.currentPlayer !== state.crownHolder) {
    throw new Error('Only the crown holder can declare trump');
  }

  // Validate game phase allows trump declaration
  if (state.phase !== 'TRUMP_DECLARATION') {
    throw new Error('Trump can only be declared during the trump declaration phase');
  }

  // Validate suit is a valid suit
  const validSuits: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
  if (!validSuits.includes(suit)) {
    throw new Error('Invalid suit selected');
  }

  // Update game state with trump suit
  state.trumpSuit = suit;
  state.phase = 'DEALING_FINAL';
}

/**
 * Sets up the first trick leader after final dealing
 * The lead player for the first trick is the player left of the dealer
 */
export function setFirstTrickLeader(state: GameState): void {
  // First trick leader is player left of dealer
  state.currentTrick.leadPlayer = (state.dealer + 1) % 4;
  state.currentPlayer = state.currentTrick.leadPlayer;
}

/**
 * Advances the current player to the next player clockwise
 */
export function advanceTurn(state: GameState): void {
  state.currentPlayer = (state.currentPlayer + 1) % 4;
}

/**
 * Checks if a card can be legally played by a player
 * - If player is leading: all cards are playable
 * - If player is following: must follow suit if possible
 * - If player cannot follow suit: all cards are playable
 */
export function canPlayCard(state: GameState, playerIndex: number, card: Card): boolean {
  const player = state.players[playerIndex];
  
  // Check if player has the card
  if (!player.hand.some(c => c.suit === card.suit && c.rank === card.rank)) {
    return false;
  }

  // If player is leading (trick is empty), all cards are playable
  if (state.currentTrick.cards.length === 0) {
    return true;
  }

  // Get the led suit
  const ledSuit = state.currentTrick.cards[0].card.suit;

  // Check if player has any cards of the led suit
  const hasLedSuit = player.hand.some(c => c.suit === ledSuit);

  // If player has led suit, must play led suit
  if (hasLedSuit) {
    return card.suit === ledSuit;
  }

  // If player doesn't have led suit, any card is playable
  return true;
}

/**
 * Plays a card from a player's hand
 * - Validates the card can be played
 * - Removes the card from the player's hand
 * - Adds the card to the current trick
 * - Advances the turn
 */
export function playCard(state: GameState, playerIndex: number, card: Card): void {
  // Validate it's the player's turn
  if (state.currentPlayer !== playerIndex) {
    throw new Error('Not your turn');
  }

  // Validate game phase
  if (state.phase !== 'TRICK_PLAY') {
    throw new Error('Cards can only be played during trick play phase');
  }

  // Validate the card can be played
  if (!canPlayCard(state, playerIndex, card)) {
    throw new Error('Card cannot be played');
  }

  // Find and remove the card from player's hand
  const player = state.players[playerIndex];
  const cardIndex = player.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
  if (cardIndex === -1) {
    throw new Error('Card not in hand');
  }
  player.hand.splice(cardIndex, 1);

  // Add card to current trick
  state.currentTrick.cards.push({ card, player: playerIndex });

  // Check if trick is complete (4 cards played)
  if (state.currentTrick.cards.length === 4) {
    // Resolve the trick
    const winner = resolveTrick(state.currentTrick, state.trumpSuit!);
    state.currentTrick.winner = winner;
    
    // Add to completed tricks
    state.completedTricks.push({ ...state.currentTrick });
    
    // Check if round is complete (8 tricks played)
    if (state.completedTricks.length === 8) {
      state.phase = 'ROUND_END';
    } else {
      // Start new trick with winner as lead
      state.currentTrick = { leadPlayer: winner, cards: [], winner: null };
      state.currentPlayer = winner;
    }
  } else {
    // Advance to next player
    advanceTurn(state);
  }
}

/**
 * Resolves a trick and determines the winner
 * - If any trump cards played: highest trump wins
 * - Otherwise: highest card of led suit wins
 */
export function resolveTrick(trick: Trick, trumpSuit: Suit): number {
  if (trick.cards.length !== 4) {
    throw new Error('Trick must have exactly 4 cards');
  }

  const ledSuit = trick.cards[0].card.suit;
  
  // Find all trump cards
  const trumpCards = trick.cards.filter(pc => pc.card.suit === trumpSuit);
  
  if (trumpCards.length > 0) {
    // Highest trump wins
    let highestTrump = trumpCards[0];
    for (const pc of trumpCards) {
      if (RANK_VALUES[pc.card.rank] > RANK_VALUES[highestTrump.card.rank]) {
        highestTrump = pc;
      }
    }
    return highestTrump.player;
  }
  
  // No trump played, highest led suit wins
  const ledSuitCards = trick.cards.filter(pc => pc.card.suit === ledSuit);
  let highestLedSuit = ledSuitCards[0];
  for (const pc of ledSuitCards) {
    if (RANK_VALUES[pc.card.rank] > RANK_VALUES[highestLedSuit.card.rank]) {
      highestLedSuit = pc;
    }
  }
  return highestLedSuit.player;
}
