import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import { fetchProfile } from '@/lib/api';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initializing: boolean;
  init: () => Promise<void>;
  syncSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

let listenerRegistered = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: false,
  initializing: true,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, loading: !!session?.user });

    if (session?.user) {
      try {
        const profile = await fetchProfile();
        set({ profile });
      } catch {
        // Profile may not exist yet if trigger hasn't fired
      } finally {
        set({ loading: false });
      }
    }

    if (!listenerRegistered) {
      listenerRegistered = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null, loading: !!session?.user });
        if (session?.user) {
          (async () => {
            try {
              const profile = await fetchProfile();
              set({ profile, loading: false });
            } catch {
              set({ profile: null, loading: false });
            }
          })();
        } else {
          set({ profile: null, loading: false });
        }
      });
    }

    set({ initializing: false });
  },

  syncSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, loading: !!session?.user });
    if (session?.user && !get().profile) {
      try {
        const profile = await fetchProfile();
        set({ profile, loading: false });
      } catch {
        // Profile may not be ready yet; onAuthStateChange will retry
      } finally {
        set({ loading: false });
      }
    } else if (!session?.user) {
      set({ loading: false });
    }
  },

  refreshProfile: async () => {
    try {
      const profile = await fetchProfile();
      set({ profile });
    } catch {
      // ignore
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, loading: false });
  },
}));
