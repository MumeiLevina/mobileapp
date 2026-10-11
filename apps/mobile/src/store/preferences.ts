import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
type State = {
  theme: "light" | "dark" | "system";
  locale: "vi" | "en";
  showAvatar: boolean;
  reducedAvatarMotion: boolean;
  setTheme: (theme: State["theme"]) => void;
  setLocale: (locale: State["locale"]) => void;
  setShowAvatar: (showAvatar: boolean) => void;
  setReducedAvatarMotion: (reducedAvatarMotion: boolean) => void;
};
export const usePreferences = create<State>()(
  persist(
    (set) => ({
      theme: "system",
      locale: "vi",
      showAvatar: true,
      reducedAvatarMotion: false,
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setShowAvatar: (showAvatar) => set({ showAvatar }),
      setReducedAvatarMotion: (reducedAvatarMotion) =>
        set({ reducedAvatarMotion }),
    }),
    {
      name: "mori-preferences",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
