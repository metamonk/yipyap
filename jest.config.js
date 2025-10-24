module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testMatch: [
    "<rootDir>/tests/unit/**/*.test.ts",
    "<rootDir>/tests/unit/**/*.test.tsx",
    "<rootDir>/tests/integration/**/*.test.ts",
    "<rootDir>/tests/integration/**/*.test.tsx"
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/tests/rules/",
    "<rootDir>/tests/e2e/"
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1"
  },
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "services/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "stores/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/__tests__/**"
  ],
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|react-navigation|@react-navigation|expo|expo-.*|@expo|@expo/.*|@unimodules|react-native-screens|react-native-safe-area-context|react-native-reanimated|react-native-gesture-handler|react-native-svg|react-native-chart-kit|firebase|@firebase)/)"
  ],
  globals: {
    "ts-jest": {
      tsconfig: {
        jsx: "react"
      }
    }
  }
};