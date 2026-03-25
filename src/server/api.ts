// Contract Crown Server API
// REST API endpoints

import { Elysia } from 'elysia';

export const createApi = (app: Elysia) => {
  app
    .get('/health', () => ({ status: 'ok' }))
    .get('/games', () => ({ games: [] }))
    .post('/games', () => ({ created: true }));
};
