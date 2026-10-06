import { create } from "zustand";
import { config } from "../lib/config";
type Session = {
  ready: boolean;
  userId: string | null;
  setSession: (userId: string | null) => void;
};
export const useSession = create<Session>((set) => ({
  ready: config.demo,
  userId: config.demo ? "demo" : null,
  setSession: (userId) => set({ ready: true, userId }),
}));
