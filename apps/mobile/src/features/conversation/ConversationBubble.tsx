import { View } from "react-native";
import { Message } from "@mori/shared";
import { MoriText } from "../../components/ui";
import { useTheme } from "../../theme";
export function ConversationBubble({ message }: { message: Message }) {
  const t = useTheme();
  const mine = message.role === "user";
  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "91%",
        padding: 18,
        borderRadius: 22,
        borderBottomRightRadius: mine ? 5 : 22,
        borderBottomLeftRadius: mine ? 22 : 5,
        backgroundColor: mine ? t.soft : t.surface,
        marginVertical: 7,
      }}
    >
      {!mine && (
        <MoriText variant="small" muted style={{ marginBottom: 5 }}>
          Mori
        </MoriText>
      )}
      <MoriText selectable translate={false}>
        {message.content}
      </MoriText>
    </View>
  );
}
