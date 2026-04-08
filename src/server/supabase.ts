// Contract Crown Supabase Client
// Supabase client for authentication, user data, and room storage

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 
  process.env.SUPABASE_URL_DEV || 
  'https://your-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY_DEV || 
  'your-anon-key-here';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SERVICE_ROLE_KEY_DEV || 
  '';

export interface UserProfile {
  id: string;
  username: string;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  user_metadata: {
    username?: string;
  };
}

export interface RoomRow {
  id: string;
  room_code: string;
  phase: string;
  players: any[];
  admin_session_id: string | null;
  admin_username: string;
  player_count: number;
  max_players: number;
  created_at: string;
  updated_at: string;
}

class SupabaseService {
  private client: SupabaseClient;
  private serviceClient: SupabaseClient | null = null;
  private static instance: SupabaseService;

  private constructor() {
    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    
    // Initialize service client if service role key is available
    if (supabaseServiceRoleKey) {
      this.serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    }
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  public getClient(): SupabaseClient {
    return this.client;
  }

  public getServiceClient(): SupabaseClient | null {
    return this.serviceClient;
  }

  public hasServiceClient(): boolean {
    return this.serviceClient !== null;
  }

  public getUrl(): string {
    return supabaseUrl;
  }

  public getAnonKey(): string {
    return supabaseAnonKey;
  }

  async signUp(email: string, password: string, username: string) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          username
        }
      }
    });

    if (error) {
      return { error: error.message, data: null };
    }

    return { error: null, data };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password
    });

    if (error) {
      return { error: error.message, data: null };
    }

    return { error: null, data };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }

  async getUser(accessToken: string) {
    const { data, error } = await this.client.auth.getUser(accessToken);

    if (error) {
      return { error: error.message, user: null };
    }

    return { error: null, user: data.user };
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching profile:', error);
      return null;
    }

    return data as UserProfile;
  }

  // --- Room CRUD Operations ---

  async insertRoom(room: Omit<RoomRow, 'created_at' | 'updated_at'>): Promise<{ error: string | null }> {
    if (!this.serviceClient) {
      return { error: 'Service client not initialized' };
    }

    const { error } = await this.serviceClient
      .from('rooms')
      .insert(room);

    if (error) {
      console.error('[Supabase] Error inserting room:', error);
      return { error: error.message };
    }

    return { error: null };
  }

  async getRoom(roomId: string): Promise<RoomRow | null> {
    if (!this.serviceClient) {
      return null;
    }

    const { data, error } = await this.serviceClient
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('[Supabase] Error fetching room:', error);
      return null;
    }

    return data as RoomRow;
  }

  async getRoomByCode(roomCode: string): Promise<RoomRow | null> {
    if (!this.serviceClient) {
      return null;
    }

    const { data, error } = await this.serviceClient
      .from('rooms')
      .select('*')
      .eq('room_code', roomCode.toUpperCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('[Supabase] Error fetching room by code:', error);
      return null;
    }

    return data as RoomRow;
  }

  async updateRoom(roomId: string, updates: Partial<RoomRow>): Promise<{ error: string | null }> {
    if (!this.serviceClient) {
      return { error: 'Service client not initialized' };
    }

    const { error } = await this.serviceClient
      .from('rooms')
      .update(updates)
      .eq('id', roomId);

    if (error) {
      console.error('[Supabase] Error updating room:', error);
      return { error: error.message };
    }

    return { error: null };
  }

  async deleteRoom(roomId: string): Promise<{ error: string | null }> {
    if (!this.serviceClient) {
      return { error: 'Service client not initialized' };
    }

    const { error } = await this.serviceClient
      .from('rooms')
      .delete()
      .eq('id', roomId);

    if (error) {
      console.error('[Supabase] Error deleting room:', error);
      return { error: error.message };
    }

    return { error: null };
  }

  async getAllRooms(): Promise<RoomRow[]> {
    if (!this.serviceClient) {
      return [];
    }

    const { data, error } = await this.serviceClient
      .from('rooms')
      .select('*')
      .eq('phase', 'WAITING_FOR_PLAYERS');

    if (error) {
      console.error('[Supabase] Error fetching all rooms:', error);
      return [];
    }

    return (data as RoomRow[]) || [];
  }

  async cleanupOldRooms(ttlHours: number = 12): Promise<number> {
    if (!this.serviceClient) {
      return 0;
    }

    const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000).toISOString();
    
    const { error, count } = await this.serviceClient
      .from('rooms')
      .delete()
      .lt('created_at', cutoff);

    if (error) {
      console.error('[Supabase] Error cleaning up old rooms:', error);
      return 0;
    }

    console.log(`[Supabase] Cleaned up ${count || 0} old rooms`);
    return count || 0;
  }
}

export const supabaseService = SupabaseService.getInstance();
