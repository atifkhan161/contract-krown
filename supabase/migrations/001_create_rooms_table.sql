-- Migration: Create rooms table for persistent room storage
-- TTL: Rooms auto-delete after 12 hours
-- Run this in Supabase SQL Editor

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  room_code VARCHAR(6) UNIQUE NOT NULL,
  phase VARCHAR(50) DEFAULT 'WAITING_FOR_PLAYERS',
  players JSONB DEFAULT '[]',
  admin_session_id TEXT,
  admin_username TEXT DEFAULT '',
  player_count INTEGER DEFAULT 0,
  max_players INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_phase ON rooms(phase);
CREATE INDEX IF NOT EXISTS idx_rooms_created ON rooms(created_at);
