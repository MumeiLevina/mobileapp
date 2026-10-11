module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/tests/**/*.test.ts"],
  modulePathIgnorePatterns: ["<rootDir>/.kilo/"],
  moduleNameMapper: {
    "^@mori/live-protocol$": "<rootDir>/packages/live-protocol/src/index.ts",
    "^@mori/shared$": "<rootDir>/packages/shared/src/index.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          ...require("./tsconfig.base.json").compilerOptions,
          module: "commonjs",
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    ],
  },
};
