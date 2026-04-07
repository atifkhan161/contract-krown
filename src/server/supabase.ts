// Contract Crown Supabase Client
// Supabase client for authentication and user data

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const isTest = process.env.NODE_ENV === 'test';

const supabaseUrl = process.env.SUPABASE_URL || 
  process.env.SUPABASE_URL_DEV || 
  'https://your-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY_DEV || 
  'your-anon-key-here';

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

class SupabaseService {
  private client: SupabaseClient;
  private static instance: SupabaseService;

  private constructor() {
    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
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
    const { data, error } = await this.client.auth.signInWithPassword({
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
      // Handle case where profile doesn't exist yet (trigger may not have run)
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching profile:', error);
      return null;
    }

    return data as UserProfile;
  }
}

export const supabaseService = SupabaseService.getInstance();