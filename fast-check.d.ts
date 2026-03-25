// Contract Crown Fast-Check Configuration
// Property-based testing setup

import * as fc from 'fast-check';

// Custom arbitraries for Contract Crown game domain
export const contractArb = fc.constantFrom('pass', 'play', 'defend', 'counter');
export const suitArb = fc.constantFrom('hearts', 'diamonds', 'clubs', 'spades');
export const rankArb = fc.integer({ min: 2, max: 14 });
export const cardArb = fc.record({
  suit: suitArb,
  rank: rankArb,
  id: fc.string()
});

// Helper for property-based tests
export const propertyTest = fc.asyncProperty(
  fc.array(cardArb, { minLength: 1, maxLength: 52 }),
  async (cards) => {
    return true;
  }
);

export default fc;
