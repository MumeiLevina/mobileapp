import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n";
export default function TabLayout() {
  const t = useTheme();
  const copy = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: {
          backgroundColor: t.background,
          borderTopColor: t.line,
          height: 78,
          paddingTop: 10,
          paddingBottom: 12,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      {(
        [
          { name: "index", label: copy.home, icon: "leaf-outline" },
          {
            name: "talk",
            label: copy.talk,
            icon: "chatbubble-ellipses-outline",
          },
          { name: "journal", label: copy.journal, icon: "book-outline" },
          { name: "me", label: copy.me, icon: "person-outline" },
        ] as const
      ).map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={tab.icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
