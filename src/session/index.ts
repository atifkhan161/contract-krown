// Contract Crown Session Module
// Main entry point for session module

export * from './session-manager.js';

import { SessionManager } from './session-manager.js';

export const sessionManager = new SessionManager();
