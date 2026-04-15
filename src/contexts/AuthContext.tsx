import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface Profile {
  full_name?: string;
  email?: string;
  avatar_url?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  role: string | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Track whether a login event just happened — so App.tsx can redirect
  const justLoggedInRef = useRef(false);

  useEffect(() => {
    // 1. Check for existing session (page refresh, first load)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        if (_event === 'SIGNED_IN') {
          // Mark that a fresh login just happened
          justLoggedInRef.current = true;
        }
        fetchRole(session.user.id);
      } else {
        setUser(null);
        setRole(null);
        setProfile(null);
        setLoading(false);
        justLoggedInRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, full_name, email, avatar_url')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('[AuthContext] Profile query error:', error.message);
      }

      const userRole = data?.role || 'student';
      console.log('[AuthContext] Role for', userId, '→', userRole);

      setRole(userRole);
      setProfile({
        full_name: data?.full_name || null,
        email: data?.email || null,
        avatar_url: data?.avatar_url || null,
      });
    } catch (err) {
      console.warn('[AuthContext] Profile fetch failed, defaulting to student:', err);
      setRole('student');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setProfile(null);
    justLoggedInRef.current = false;
    window.location.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, signOut, justLoggedInRef }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
