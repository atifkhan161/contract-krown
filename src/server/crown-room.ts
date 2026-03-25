// Contract Crown Room
// Game room implementation

import { Room, Client } from 'colyseus';

export class CrownGameRoom extends Room {
  onCreate(options: any) {
    this.setState({
      players: [],
      gameState: null
    });
  }

  onJoin(client: Client) {
    // Handle join
  }
}
