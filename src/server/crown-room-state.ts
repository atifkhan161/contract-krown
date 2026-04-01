// Contract Crown Colyseus Schema
// State serialization classes for efficient delta synchronization

import { Schema, type, ArraySchema, MapSchema } from '@colyseus/schema';

export class CardSchema extends Schema {
  @type('string') suit: string = '';
  @type('string') rank: string = '';
  @type('number') value: number = 0;
}

export class PlayedCardSchema extends Schema {
  @type(CardSchema) card = new CardSchema();
  @type('number') player: number = 0;
}

export class TrickSchema extends Schema {
  @type('number') leadPlayer: number = 0;
  @type([PlayedCardSchema]) cards = new ArraySchema<PlayedCardSchema>();
  @type('number') winner: number | null = null;
}

export class PlayerSchema extends Schema {
  @type('number') id: number = 0;
  @type([CardSchema]) hand = new ArraySchema<CardSchema>();
  @type('number') team: number = 0;
  @type('boolean') isBot: boolean = false;
  @type('boolean') disconnected: boolean = false;
  @type('string') sessionId: string = '';
}

export class GameStateSchema extends Schema {
  @type('string') phase: string = 'WAITING_FOR_PLAYERS';
  @type('number') currentPlayer: number = 0;
  @type('number') crownHolder: number = 0;
  @type('number') dealer: number = 0;
  @type('number') trumpDeclarer: number | null = null;
  @type('string') trumpSuit: string | null = null;
  @type('number') scoreTeam0: number = 0;
  @type('number') scoreTeam1: number = 0;
  @type('number') partnerIndex: number = 0;
  @type('boolean') isDeclaringTeam: boolean = false;
  @type('number') tricksWonByTeam: number = 0;
  @type('number') roundNumber: number = 0;

  @type(TrickSchema) currentTrick = new TrickSchema();
  @type([TrickSchema]) completedTricks = new ArraySchema<TrickSchema>();
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();

  @type('number') disconnectedAt: number = 0;
  @type('number') disconnectedPlayerIndex: number = -1;
}
