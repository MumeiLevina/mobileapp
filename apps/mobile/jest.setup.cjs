jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(),
  },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View: RNView, Text: RNText } = require("react-native");
  return {
    useReducedMotion: () => true,
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (fn) => fn(),
    useDerivedValue: (fn) => ({ value: fn() }),
    withRepeat: (value) => value,
    withTiming: (value) => value,
    withSpring: (value) => value,
    withDelay: (_delay, value) => value,
    cancelAnimation: () => {},
    Easing: {
      inOut: (fn) => fn,
      out: (fn) => fn,
      in: (fn) => fn,
      linear: (fn) => fn,
      sin: (fn) => fn,
    },
    ReduceMotion: { System: "system", Always: "always", Never: "never" },
    FadeIn: { duration: () => ({}) },
    FadeOut: { duration: () => ({}) },
    Layout: { springify: () => ({}) },
    runOnJS: (fn) => fn,
    default: {
      View: RNView,
      Text: RNText,
    },
    __esModule: true,
  };
});
