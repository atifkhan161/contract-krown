// Contract Crown Online Multiplayer Tests
// Tests for Task 24: Online multiplayer client integration

import { describe, it, expect } from 'vitest';
import { ColyseusClientWrapper } from '@src/ui/colyseus-client-wrapper.js';
import { OnlineGameController } from '@src/ui/online-game-controller.js';
import { ReconnectionOverlay } from '@src/ui/reconnection-overlay.js';

describe('Colyseus Client Wrapper', () => {
  describe('initial state', () => {
    it('should start in disconnected state', () => {
      const wrapper = new ColyseusClientWrapper({
        onStateChange: () => {},
        onError: () => {},
        onLeave: () => {}
      });
      expect(wrapper.state).toBe('disconnected');
      expect(wrapper.roomId).toBeNull();
      expect(wrapper.sessionId).toBeNull();
    });
  });

  describe('connection', () => {
    it('should throw when joining room without connecting first', async () => {
      const wrapper = new ColyseusClientWrapper({
        onStateChange: () => {},
        onError: () => {},
        onLeave: () => {}
      });
      await expect(wrapper.joinRoom('test-room')).rejects.toThrow('Not connected');
    });

    it('should throw when creating room without connecting first', async () => {
      const wrapper = new ColyseusClientWrapper({
        onStateChange: () => {},
        onError: () => {},
        onLeave: () => {}
      });
      await expect(wrapper.createRoom()).rejects.toThrow('Not connected');
    });
  });

  describe('disconnect', () => {
    it('should transition to disconnected state after disconnect', () => {
      const wrapper = new ColyseusClientWrapper({
        onStateChange: () => {},
        onError: () => {},
        onLeave: () => {}
      });
      wrapper.disconnect();
      expect(wrapper.state).toBe('disconnected');
    });
  });
});

describe('Online Game Controller', () => {
  describe('initial state', () => {
    it('should create controller with default config', () => {
      const controller = new OnlineGameController();
      expect(controller.getUserPlayerIndex()).toBe(0);
      expect(controller.getConnectionState()).toBe('disconnected');
      expect(controller.getRoomId()).toBeNull();
      controller.stop();
    });

    it('should create controller with custom config', () => {
      const controller = new OnlineGameController({
        userPlayerIndex: 2,
        serverUrl: 'ws://localhost:2567'
      });
      expect(controller.getUserPlayerIndex()).toBe(2);
      controller.stop();
    });
  });

  describe('state mapping', () => {
    it('should return null game state before connection', () => {
      const controller = new OnlineGameController();
      expect(controller.getGameState()).toBeNull();
      controller.stop();
    });
  });

  describe('lifecycle', () => {
    it('should stop without error', () => {
      const controller = new OnlineGameController();
      expect(() => controller.stop()).not.toThrow();
    });

    it('should pause and resume without error', () => {
      const controller = new OnlineGameController();
      expect(() => {
        controller.pause();
        controller.resume();
      }).not.toThrow();
      controller.stop();
    });
  });
});

describe('Reconnection Overlay', () => {
  describe('initial state', () => {
    it('should create overlay instance', () => {
      const overlay = new ReconnectionOverlay();
      expect(overlay).toBeDefined();
    });
  });

  describe('callback', () => {
    it('should set onReturnToLobby callback', () => {
      let called = false;
      const overlay = new ReconnectionOverlay();
      overlay.setOnReturnToLobby(() => { called = true; });
      expect(called).toBe(false);
    });
  });
});
