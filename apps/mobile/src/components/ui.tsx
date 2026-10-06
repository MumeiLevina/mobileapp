import {
  Children,
  ComponentProps,
  PropsWithChildren,
  ReactNode,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
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
import { interactionFeedback } from "../services/interaction-feedback";

export type MoriButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "dangerGhost";
type FeedbackType = "none" | "primary" | "selection" | "success" | "warning";

function runFeedback(type: FeedbackType) {
  if (type === "none") return;
  void interactionFeedback[type]();
}

type MoriPressableProps = Omit<
  ComponentProps<typeof Pressable>,
  "children" | "onPress" | "style"
> & {
  children: ReactNode;
  feedback?: FeedbackType;
  guardMs?: number;
  onPress?: NonNullable<ComponentProps<typeof Pressable>["onPress"]>;
  style?:
    ViewStyle | ViewStyle[] | ((pressed: boolean) => ViewStyle | ViewStyle[]);
};

export function MoriPressable({
  onPress,
  disabled = false,
  feedback = "none",
  guardMs = 0,
  style,
  children,
  ...props
}: MoriPressableProps) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const lastPressAt = useRef(0);
  const lastPressHandler = useRef(onPress);
  const [focused, setFocused] = useState(false);
  if (lastPressHandler.current !== onPress) {
    lastPressHandler.current = onPress;
    lastPressAt.current = 0;
  }
  const animate = (value: number) => {
    if (reducedMotion) return;
    Animated.timing(scale, {
      toValue: value,
      duration: value < 1 ? 90 : 120,
      useNativeDriver: true,
    }).start();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        {...props}
        disabled={disabled}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onPressIn={(event) => {
          animate(0.98);
          props.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animate(1);
          props.onPressOut?.(event);
        }}
        onPress={(event) => {
          if (disabled) return;
          const now = Date.now();
          if (guardMs > 0 && now - lastPressAt.current < guardMs) return;
          lastPressAt.current = now;
          runFeedback(feedback);
          onPress?.(event);
        }}
        style={({ pressed }) => [
          typeof style === "function" ? style(pressed) : style,
          focused && styles.focused,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
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
  variant,
  secondary = false,
  size = "large",
  disabled = false,
  loading = false,
  loadingLabel,
  icon,
  feedback,
}: PropsWithChildren<{
  onPress: () => void;
  variant?: MoriButtonVariant;
  /** @deprecated Use variant="secondary". */
  secondary?: boolean;
  size?: "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  feedback?: FeedbackType;
}>) {
  const t = useTheme();
  const tr = useTranslate();
  const resolvedVariant = variant ?? (secondary ? "secondary" : "primary");
  const inactive = disabled || loading;
  const filled = resolvedVariant === "primary" || resolvedVariant === "danger";
  const danger =
    resolvedVariant === "danger" || resolvedVariant === "dangerGhost";
  const backgroundColor = inactive
    ? t.line
    : resolvedVariant === "primary"
      ? t.primary
      : resolvedVariant === "danger"
        ? t.error
        : resolvedVariant === "secondary"
          ? t.soft
          : "transparent";
  const foregroundColor = inactive
    ? t.muted
    : filled
      ? t.onPrimary
      : danger
        ? t.error
        : t.text;
  return (
    <MoriPressable
      accessibilityRole="button"
      accessibilityLabel={
        typeof children === "string" ? tr(children) : undefined
      }
      disabled={inactive}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      guardMs={350}
      feedback={
        feedback ??
        (danger
          ? "warning"
          : resolvedVariant === "primary"
            ? "primary"
            : "none")
      }
      style={(pressed) => [
        styles.button,
        {
          minHeight: size === "large" ? 54 : 46,
          paddingVertical: size === "large" ? 14 : 10,
          backgroundColor,
          borderColor:
            resolvedVariant === "dangerGhost"
              ? t.error
              : resolvedVariant === "ghost"
                ? "transparent"
                : inactive
                  ? t.line
                  : backgroundColor,
          opacity: pressed ? 0.82 : inactive ? 0.72 : 1,
        },
      ]}
    >
      {loading && <ActivityIndicator size="small" color={foregroundColor} />}
      {icon && !loading && (
        <Ionicons name={icon} size={20} color={foregroundColor} />
      )}
      <MoriText
        style={{
          color: foregroundColor,
          fontWeight: "600",
          textAlign: "center",
          flexShrink: 1,
        }}
      >
        {loading && loadingLabel ? tr(loadingLabel) : children}
      </MoriText>
    </MoriPressable>
  );
}

export function MoriIconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = "ghost",
  disabled = false,
  loading = false,
  selected = false,
  feedback = "none",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  variant?: "ghost" | "primary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
  feedback?: FeedbackType;
}) {
  const t = useTheme();
  const inactive = disabled || loading;
  const background = inactive
    ? t.line
    : variant === "primary"
      ? t.primary
      : selected
        ? t.soft
        : "transparent";
  const color = inactive
    ? t.muted
    : variant === "primary"
      ? t.onPrimary
      : variant === "danger"
        ? t.error
        : t.text;
  return (
    <MoriPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading, selected }}
      disabled={inactive}
      feedback={
        variant === "danger"
          ? "warning"
          : variant === "primary"
            ? "primary"
            : feedback
      }
      onPress={onPress}
      guardMs={250}
      hitSlop={4}
      style={(pressed) => [
        styles.iconButton,
        { backgroundColor: background, opacity: pressed ? 0.72 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={icon} size={22} color={color} />
      )}
    </MoriPressable>
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
        <MoriIconButton
          icon="arrow-back"
          accessibilityLabel={copy.back}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)")
          }
        />
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
export function MoriConfirmSheet({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = "Giữ lại",
  variant = "danger",
  loading = false,
  error,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  error?: unknown;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <MoriBottomSheet
      visible={visible}
      onClose={loading ? () => undefined : onCancel}
    >
      <View style={styles.stack}>
        <MoriText variant="title">{title}</MoriText>
        <MoriText muted>{description}</MoriText>
        <ErrorNote error={error} />
        <MoriButton
          variant={variant}
          loading={loading}
          loadingLabel={variant === "danger" ? "Đang xóa…" : undefined}
          onPress={onConfirm}
        >
          {confirmLabel}
        </MoriButton>
        <MoriButton variant="ghost" disabled={loading} onPress={onCancel}>
          {cancelLabel}
        </MoriButton>
      </View>
    </MoriBottomSheet>
  );
}

export function MoriNotice({
  children,
  tone = "success",
}: PropsWithChildren<{ tone?: "success" | "neutral" | "error" }>) {
  const t = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        {
          backgroundColor: tone === "neutral" ? t.soft : t.surface,
          borderColor: tone === "error" ? t.error : t.line,
        },
      ]}
    >
      <MoriText style={tone === "error" ? { color: t.error } : undefined}>
        {children}
      </MoriText>
    </View>
  );
}
export function Choice({
  title,
  subtitle,
  selected,
  onPress,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  const tr = useTranslate();
  return (
    <MoriPressable
      accessibilityRole="radio"
      accessibilityLabel={tr(title)}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      feedback="selection"
      onPress={onPress}
      style={(pressed) => [
        styles.choice,
        {
          borderColor: selected ? t.primary : t.line,
          backgroundColor: selected ? t.soft : t.surface,
          opacity: disabled ? 0.6 : pressed ? 0.84 : 1,
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
    </MoriPressable>
  );
}

export function MoriChip({
  label,
  selected,
  onPress,
  role = "checkbox",
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: "checkbox" | "radio";
  disabled?: boolean;
}) {
  const t = useTheme();
  const tr = useTranslate();
  return (
    <MoriPressable
      accessibilityRole={role}
      accessibilityLabel={tr(label)}
      accessibilityState={
        role === "checkbox"
          ? { checked: selected, disabled }
          : { selected, disabled }
      }
      disabled={disabled}
      feedback="selection"
      onPress={onPress}
      style={(pressed) => [
        styles.chip,
        {
          backgroundColor: selected ? t.primary : t.soft,
          borderColor: selected ? t.primary : t.line,
          opacity: disabled ? 0.6 : pressed ? 0.82 : 1,
        },
      ]}
    >
      <MoriText
        variant="small"
        style={{ color: selected ? t.onPrimary : t.text, textAlign: "center" }}
      >
        {label}
      </MoriText>
    </MoriPressable>
  );
}

export function MoriSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  accessibilityLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segmented, { backgroundColor: t.soft }]}
    >
      {options.map((option) => (
        <MoriChip
          key={option.value}
          label={option.label}
          selected={value === option.value}
          disabled={disabled}
          role="radio"
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
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
    borderWidth: 1,
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
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
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
  chip: {
    minHeight: 44,
    minWidth: 44,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
    flexGrow: 1,
    flexShrink: 1,
  },
  segmented: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    borderRadius: 20,
    padding: 5,
  },
  notice: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  focused: {
    outlineStyle: "solid",
    outlineWidth: 3,
    outlineColor: "#7F9B84",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  stack: { gap: 16 },
});
