import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { setTokens, clearTokens } from "@/lib/api";
import type { UserProfile } from "@/types";

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: UserProfile) => void;
  setAuth: (user: UserProfile, tokens: { access_token: string; refresh_token: string }) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: true }),

      setAuth: (user, tokens) => {
        setTokens(tokens);
        set({ user, isAuthenticated: true });
      },

      logout: () => {
        clearTokens();
        set({ user: null, isAuthenticated: false });
      },

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "mml_auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
