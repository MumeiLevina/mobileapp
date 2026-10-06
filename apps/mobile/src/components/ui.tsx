import { Children, PropsWithChildren, ReactNode } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { typography, useTheme } from "../theme";
import { useT, useTranslate } from "../i18n";
import { useReducedMotion } from "react-native-reanimated";
export function MoriText({
  variant = "body",
  muted = false,
  style,
  children,
  translate = true,
  ...props
}: TextProps & {
  variant?: keyof typeof typography;
  muted?: boolean;
  translate?: boolean;
}) {
  const theme = useTheme();
  const tr = useTranslate();
  return (
    <Text
      {...props}
      style={[
        {
          fontSize: typography[variant],
          lineHeight: typography[variant] * 1.48,
          color: muted ? theme.muted : theme.text,
          ...(["hero", "title"].includes(variant)
            ? { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" }
            : {}),
        },
        style,
      ]}
    >
      {Children.map(children, (child) =>
        typeof child === "string" && translate ? tr(child) : child,
      )}
    </Text>
  );
}
export function MoriButton({
  children,
  onPress,
  secondary = false,
  disabled = false,
  loading = false,
  icon,
}: PropsWithChildren<{
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}>) {
  const t = useTheme();
  const tr = useTranslate();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        typeof children === "string" ? tr(children) : undefined
      }
      disabled={disabled || loading}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? t.soft : t.primary,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={20}
          color={secondary ? t.text : t.onPrimary}
        />
      )}
      <MoriText
        style={{
          color: secondary ? t.text : t.onPrimary,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {loading ? "…" : children}
      </MoriText>
    </Pressable>
  );
}
export function MoriCard({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.surface, borderColor: t.line },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function MoriInput(props: TextInputProps) {
  const t = useTheme();
  const tr = useTranslate();
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...props}
      placeholder={props.placeholder ? tr(props.placeholder) : undefined}
      accessibilityLabel={
        props.accessibilityLabel ? tr(props.accessibilityLabel) : undefined
      }
      style={[
        styles.input,
        { backgroundColor: t.surface, color: t.text, borderColor: t.line },
        props.style,
      ]}
    />
  );
}
export function ScreenContainer({
  children,
  back = false,
  scroll = true,
}: PropsWithChildren<{ back?: boolean; scroll?: boolean }>) {
  const t = useTheme();
  const copy = useT();
  const content = (
    <>
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)")
          }
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={23} color={t.text} />
        </Pressable>
      )}
      {children}
    </>
  );
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: t.background }}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.screen}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.screen, { flex: 1 }]}>{content}</View>
      )}
    </SafeAreaView>
  );
}
export function MoriBottomSheet({
  visible,
  onClose,
  children,
}: PropsWithChildren<{ visible: boolean; onClose: () => void }>) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <Modal
      visible={visible}
      animationType={reducedMotion ? "none" : "slide"}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Đóng"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: t.background }]}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 3,
              backgroundColor: t.line,
              alignSelf: "center",
              marginBottom: 20,
            }}
          />
          <ScrollView keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function Choice({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const tr = useTranslate();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={tr(title)}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          borderColor: selected ? t.primary : t.line,
          backgroundColor: selected ? t.soft : t.surface,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <MoriText style={{ fontWeight: "500" }}>{title}</MoriText>
        {subtitle && (
          <MoriText muted variant="small">
            {subtitle}
          </MoriText>
        )}
      </View>
      <Ionicons
        name={selected ? "checkmark-circle" : "ellipse-outline"}
        size={23}
        color={selected ? t.primary : t.muted}
      />
    </Pressable>
  );
}
export function ErrorNote({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const t = useTheme();
  const copy = useT();
  if (!error) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ gap: 8, paddingVertical: 12 }}
    >
      <MoriText style={{ color: t.error }}>
        {error instanceof Error ? error.message : String(error)}
      </MoriText>
      {retry && (
        <MoriButton secondary onPress={retry}>
          {copy.retry}
        </MoriButton>
      )}
    </View>
  );
}
export function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 26,
        marginBottom: 14,
      }}
    >
      <MoriText variant="subtitle" style={{ flex: 1 }}>
        {title}
      </MoriText>
      {action}
    </View>
  );
}
export function Loading() {
  const copy = useT();
  return (
    <MoriText muted style={{ padding: 24, textAlign: "center" }}>
      {copy.loading}
    </MoriText>
  );
}
export const styles = StyleSheet.create({
  screen: {
    padding: 24,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    gap: 16,
  },
  button: {
    minHeight: 54,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  card: { padding: 20, borderRadius: 24, borderWidth: 1, gap: 12 },
  input: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
    fontSize: 16,
    minHeight: 54,
    textAlignVertical: "top",
  },
  back: { width: 44, height: 44, justifyContent: "center" },
  overlay: {
    flex: 1,
    backgroundColor: "#10201977",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "90%",
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
  },
  choice: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  stack: { gap: 16 },
});
