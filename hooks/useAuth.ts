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
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Fetch user profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          // If no profile exists, create one
          if (profileError || !profile) {
            console.log('Creating profile for user:', session.user.id);
            const profilesTable: any = supabase.from('profiles');
            const { data: newProfile } = await profilesTable
              .insert({
                id: session.user.id,
                full_name: session.user.email?.split('@')[0] || 'User',
                preferred_language: 'en',
              })
              .select()
              .single();

            setAuthState({
              user: session.user,
              profile: newProfile || null,
              session,
              loading: false,
            });
          } else {
            setAuthState({
              user: session.user,
              profile: profile,
              session,
              loading: false,
            });
          }
        } else {
          setAuthState({
            user: null,
            profile: null,
            session: null,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Auth error:', error);
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
        console.log('Auth state changed:', event, 'User:', session?.user?.id);
        
        if (session?.user) {
          // FAST PATH: Set user immediately, load profile in background
          console.log('Setting auth state immediately');
          setAuthState({
            user: session.user,
            profile: null,
            session,
            loading: false,
          });
          
          // Load profile in background (non-blocking)
          setTimeout(async () => {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (profile) {
                setAuthState(prev => ({ ...prev, profile }));
              } else {
                // Create profile if missing
                const { data: newProfile } = await supabase
                  .from('profiles')
                  .insert({
                    id: session.user.id,
                    full_name: session.user.email?.split('@')[0] || 'User',
                    preferred_language: 'en',
                  })
                  .select()
                  .single();
                
                if (newProfile) {
                  setAuthState(prev => ({ ...prev, profile: newProfile }));
                }
              }
            } catch (error) {
              console.error('Background profile load error:', error);
            }
          }, 100);
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
    console.log('Attempting sign in for:', email);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Sign in error:', error);
        return { data, error };
      }
      
      console.log('Sign in successful, user:', data.user?.id);
      return { data, error };
    } catch (err) {
      console.error('Sign in exception:', err);
      return { data: null, error: err as any };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
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
      // Wait a moment for auth to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const profilesTable: any = supabase.from('profiles');
      await profilesTable.insert({
        id: data.user.id,
        full_name: fullName || 'User',
        preferred_language: 'en',
      }).select().single();
    }
    
    return { data, error };
  };

  const signInWithOTP = async (email: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    return { data, error };
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
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

      const profilesTable: any = supabase.from('profiles');
      await profilesTable.update({
        is_guest: true,
        guest_expires_at: expiryDate.toISOString(),
      }).eq('id', data.user.id);
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
    isGuest: (authState.profile as any)?.is_guest || false,
  };
}
