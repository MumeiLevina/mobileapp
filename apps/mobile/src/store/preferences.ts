import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
type State = {
  theme: "light" | "dark" | "system";
  locale: "vi" | "en";
  setTheme: (theme: State["theme"]) => void;
  setLocale: (locale: State["locale"]) => void;
};
export const usePreferences = create<State>()(
  persist(
    (set) => ({
      theme: "system",
      locale: "vi",
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "mori-preferences",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
