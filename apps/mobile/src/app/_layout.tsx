import { useEffect, useState } from "react";
import { Stack, router, useSegments } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import NetInfo from "@react-native-community/netinfo";
import { View } from "react-native";
import { queryClient } from "../services/api";
import { supabase } from "../services/auth";
import { config } from "../lib/config";
import { useSession } from "../store/session";
import { useTheme } from "../theme";
import { MoriText } from "../components/ui";
import { useT } from "../i18n";
import { useReducedMotion } from "react-native-reanimated";
export default function RootLayout() {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const copy = useT();
  const [offline, setOffline] = useState(false);
  const session = useSession();
  const segments = useSegments();
  useEffect(() => {
    if (config.demo) return;
    supabase?.auth
      .getSession()
      .then(({ data }) => session.setSession(data.session?.user.id ?? null))
      .catch(() => session.setSession(null));
    const subscription = supabase?.auth.onAuthStateChange((_event, value) => {
      queryClient.clear();
      session.setSession(value?.user.id ?? null);
    });
    if (!supabase) session.setSession(null);
    return () => subscription?.data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (
      !config.demo &&
      session.ready &&
      !session.userId &&
      segments[0] !== "auth"
    )
      router.replace("/auth");
  }, [session.ready, session.userId, segments]);
  useEffect(
    () =>
      NetInfo.addEventListener((state) =>
        setOffline(state.isConnected === false),
      ),
    [],
  );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={t.night ? "light" : "dark"} />
          <View style={{ flex: 1, backgroundColor: t.background }}>
            {config.demo && (
              <View
                style={{
                  backgroundColor: t.soft,
                  padding: 5,
                  alignItems: "center",
                }}
              >
                <MoriText variant="small" style={{ fontSize: 11 }}>
                  {copy.demo}
                </MoriText>
              </View>
            )}
            {offline && (
              <MoriText
                accessibilityLiveRegion="polite"
                style={{ padding: 10, backgroundColor: t.peach }}
              >
                {copy.offline}
              </MoriText>
            )}
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: t.background },
                animation: reducedMotion ? "none" : "fade",
              }}
            />
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
