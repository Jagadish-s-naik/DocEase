'use client';

import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';
import { Profile } from '@/types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
  });

  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Fetch user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setAuthState({
          user: session.user,
          profile: profile || null,
          session,
          loading: false,
        });
      } else {
        setAuthState({
          user: null,
          profile: null,
          session: null,
          loading: false,
        });
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Fetch updated profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          setAuthState({
            user: session.user,
            profile: profile || null,
            session,
            loading: false,
          });
        } else {
          setAuthState({
            user: null,
            profile: null,
            session: null,
            loading: false,
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    
    if (error) {
      console.error('Signup error details:', error);
      return { data, error };
    }

    // Create profile manually after successful signup
    if (data.user) {
      await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: fullName || 'User',
          preferred_language: 'en',
        })
        .select()
        .single();
    }
    
    return { data, error };
  };

  const signInWithOTP = async (email: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    return { data, error };
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const createGuestUser = async () => {
    const guestEmail = `guest_${Date.now()}@docease.temp`;
    const guestPassword = Math.random().toString(36).slice(-12);
    
    const { data, error } = await supabase.auth.signUp({
      email: guestEmail,
      password: guestPassword,
      options: {
        data: {
          full_name: 'Guest User',
          is_guest: true,
        },
      },
    });

    // Update profile to mark as guest with expiry
    if (data.user) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7); // 7 days

      await supabase
        .from('profiles')
        .update({
          is_guest: true,
          guest_expires_at: expiryDate.toISOString(),
        })
        .eq('id', data.user.id);
    }

    return { data, error };
  };

  return {
    ...authState,
    signIn,
    signUp,
    signInWithOTP,
    signInWithGoogle,
    signOut,
    createGuestUser,
    isAuthenticated: !!authState.user,
    isGuest: authState.profile?.is_guest || false,
  };
}
