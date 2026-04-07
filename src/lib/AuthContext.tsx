import { createContext, useContext, ReactNode, useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export interface GhostKeyUser {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

interface AuthContextType {
  user: GhostKeyUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: () => Promise<{ error: string | null }>;
  signUp: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user,
    isLoading,
    isAuthenticated,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const value = useMemo<AuthContextType>(() => ({
    user: user
      ? {
          id: user.sub || "",
          email: user.email || null,
          name: user.name || null,
          picture: user.picture || null,
        }
      : null,
    loading: isLoading,
    isAuthenticated,
    signIn: async () => {
      try {
        await loginWithRedirect({ appState: { returnTo: "/app" } });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Login failed." };
      }
    },
    signUp: async () => {
      try {
        await loginWithRedirect({
          appState: { returnTo: "/app" },
          authorizationParams: { screen_hint: "signup" },
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Signup failed." };
      }
    },
    signOut: async () => {
      logout({
        logoutParams: {
          returnTo: window.location.origin,
        },
      });
    },
    getAccessToken: async () => {
      try {
        return await getAccessTokenSilently();
      } catch {
        return null;
      }
    },
  }), [getAccessTokenSilently, isAuthenticated, isLoading, loginWithRedirect, logout, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
