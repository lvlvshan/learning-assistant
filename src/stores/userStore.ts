import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: string;
  username: string;
  name: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  classId: string | null;
  class?: { id: string; name: string; grade: string } | null;
}

interface UserStore {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: "user-storage",
    }
  )
);
