import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, hasSupabaseEnv } from "@/integrations/supabase/client";

interface AuthContextType {
  /** Supabase session user, or a demo identity when control-plane env is absent. */
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** true when VITE_SUPABASE_* were absent at build time */
  controlPlaneConfigured: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(hasSupabaseEnv);

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      controlPlaneConfigured: hasSupabaseEnv,
      async signUp(email, password) {
        if (!hasSupabaseEnv)
          return { error: "control plane offline — build-time env missing" };
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error?.message ?? null };
      },
      async signIn(email, password) {
        if (!hasSupabaseEnv)
          return { error: "control plane offline — build-time env missing" };
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return { error: error?.message ?? null };
      },
      async signOut() {
        if (!hasSupabaseEnv) return;
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
