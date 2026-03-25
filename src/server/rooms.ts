// Contract Crown Server Rooms
// Colyseus room definitions

import { Room, Client } from 'colyseus';

export class CrownRoom extends Room {
  maxClients = 4;

  onCreate(options: any) {
    this.setState({
      players: [],
      game: null
    });
  }

  onJoin(client: Client) {
    // Handle client join
  }

  onLeave(client: Client) {
    // Handle client leave
  }
}
