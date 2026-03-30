# Workflow: Distilling Heuristic Intelligence into an ONNX AI Model

This document outlines the end-to-end pipeline for generating synthetic game data, training a lightweight Neural Network, and deploying it as a 200KB ONNX model for your Mobile PWA.

---

## Phase 1: Data Generation (The Simulator)

Since we don't have millions of human games to analyze, we use your **SmartBot** (Heuristic) to play against itself. This creates "Expert Demonstrations."

### 1.1 Vectorization Logic
The AI cannot "see" a card object. We must convert the game state into a fixed-length array of numbers (a Vector).

**Input Vector (Size 70):**
- **Hand (32):** One index for each card in the 32-card deck. `1` if you have it, `0` if not.
- **Table (32):** `1` if the card is currently in the center trick, `0` if not.
- **Trump (4):** One-hot encoded suit (e.g., Spades = `[0,0,0,1]`).
- **Partner Winning (1):** `1` if your partner is currently winning the trick.
- **Crown Need (1):** A value from `0` to `1` representing how close you are to the 5-trick goal.

### 1.2 Generation Script (`scripts/generate_data.ts`)
Run this using `bun scripts/generate_data.ts`.

```typescript
import { SmartBot } from '../src/shared/botLogic';
import * as fs from 'fs';

const SAMPLES = 100000;
const trainingData = [];

for (let i = 0; i < SAMPLES; i++) {
    const state = generateRandomValidState(); // Mock a random turn
    const hand = generateRandomHand();
    
    // The "Teacher" (SmartBot) decides the best move
    const bestMove = SmartBot.getBestMove(hand, state);
    
    trainingData.push({
        input: vectorize(state, hand), 
        label: cardToId(bestMove) // Number 0-31
    });
}

fs.writeFileSync('data/expert_moves.json', JSON.stringify(trainingData));
console.log("Synthetic Dataset Created!");