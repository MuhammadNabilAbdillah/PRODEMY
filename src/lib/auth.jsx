import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// username "admin" disimpan di Supabase Auth sebagai admin@prodemy.app
const toEmail = (u) => (u.includes('@') ? u.trim() : `${u.trim().toLowerCase()}@prodemy.app`);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = belum dicek
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setProfile(null); setProfileLoaded(true); return; }
    setProfileLoaded(false);
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => { setProfile(data); setProfileLoaded(true); });
  }, [session]);

  const value = {
    session, profile,
    loading: session === undefined || !profileLoaded,
    isAdmin: profile?.role === 'admin',
    signIn: async (username, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password });
      if (error) throw new Error('Username atau password salah.');
    },
    signOut: () => supabase.auth.signOut(),
    verifyPassword: async (password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: session.user.email, password });
      return !error;
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
