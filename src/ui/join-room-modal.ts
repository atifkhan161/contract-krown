// Contract Crown Join Room Modal
// Modal for joining existing rooms via code input or browsing available rooms

import { ModalBottomSheet } from './modal-bottom-sheet.js';

export interface AvailableRoom {
  roomId: string;
  roomCode: string;
  playerCount: number;
  maxPlayers: number;
  adminSessionId: string;
}

export class JoinRoomModal {
  private bottomSheet: ModalBottomSheet;
  private onJoin: (roomId: string) => void;
  private container: HTMLElement | null = null;

  constructor(onJoin: (roomId: string) => void) {
    this.onJoin = onJoin;
    this.bottomSheet = new ModalBottomSheet({ allowBackdropDismiss: true });
  }

  setContainer(container: HTMLElement): void {
    this.container = container;
    this.bottomSheet.setContainer(container);
  }

  show(availableRooms: AvailableRoom[]): void {
    if (!this.container) return;

    this.bottomSheet.show();

    const contentHtml = `
      <div class="join-room-modal">
        <h3 class="join-room-title">Join a Room</h3>

        <div class="join-room-code-input">
          <label class="join-room-label" for="jr-code-input">Enter Room Code</label>
          <div class="join-room-input-row">
            <input
              type="text"
              id="jr-code-input"
              class="input input-bordered input-sm join-room-code-field"
              placeholder="e.g. A3KF"
              maxlength="4"
              autocomplete="off"
              spellcheck="false"
            />
            <button class="btn btn-primary btn-sm" id="jr-join-btn">Join</button>
          </div>
          <p class="join-room-error" id="jr-error-text" style="display: none;"></p>
        </div>

        <div class="join-room-divider">
          <span>or</span>
        </div>

        <div class="join-room-rooms-list">
          <h4 class="join-room-rooms-title">Available Rooms</h4>
          ${availableRooms.length === 0
            ? '<p class="join-room-empty">No rooms available</p>'
            : `<div class="join-room-rooms">${availableRooms.map(room => `
                <button class="join-room-room-card" data-room-id="${room.roomId}">
                  <span class="join-room-room-code">${room.roomCode}</span>
                  <span class="join-room-room-players">${room.playerCount}/${room.maxPlayers} players</span>
                </button>
              `).join('')}</div>`
          }
        </div>
      </div>
    `;

    this.bottomSheet.setContent(contentHtml);
    this.setupHandlers();
  }

  hide(): void {
    this.bottomSheet.hide();
  }

  private setupHandlers(): void {
    const sheet = this.bottomSheet.getSheetElement();
    if (!sheet) return;

    const codeInput = sheet.querySelector('#jr-code-input') as HTMLInputElement;
    const joinBtn = sheet.querySelector('#jr-join-btn') as HTMLElement;

    joinBtn?.addEventListener('click', () => {
      const code = codeInput?.value.trim().toUpperCase();
      if (!code) {
        this.showError('Please enter a room code');
        return;
      }
      if (!/^[A-Z0-9]{4}$/.test(code)) {
        this.showError('Code must be 4 alphanumeric characters');
        return;
      }
      this.hideError();
      this.onJoin(code);
      this.hide();
    });

    codeInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        joinBtn?.click();
      }
    });

    // Room card clicks
    sheet.querySelectorAll('.join-room-room-card').forEach((card) => {
      (card as HTMLElement).addEventListener('click', () => {
        const roomId = (card as HTMLElement).dataset.roomId;
        if (roomId) {
          this.onJoin(roomId);
          this.hide();
        }
      });
    });
  }

  private showError(message: string): void {
    const sheet = this.bottomSheet.getSheetElement();
    if (!sheet) return;
    const errorText = sheet.querySelector('#jr-error-text') as HTMLElement;
    if (errorText) {
      errorText.textContent = message;
      errorText.style.display = 'block';
    }
  }

  private hideError(): void {
    const sheet = this.bottomSheet.getSheetElement();
    if (!sheet) return;
    const errorText = sheet.querySelector('#jr-error-text') as HTMLElement;
    if (errorText) {
      errorText.style.display = 'none';
    }
  }
}
