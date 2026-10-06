const path = require("node:path");
const core = path.dirname(require.resolve("expo-modules-core/package.json"));
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    "^@mori/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^expo-modules-core$": require.resolve("expo-modules-core"),
    "^expo-modules-core/(.*)$": `${core}/$1`,
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.cjs"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-.*|@expo/.*|@react-navigation/.*|react-native-svg|react-native-reanimated|react-native-worklets|zustand)/)",
  ],
};
