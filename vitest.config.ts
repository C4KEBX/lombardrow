import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30000, // real-ffmpeg tests take seconds, longer when the suite runs in parallel
    coverage: {
      provider: "v8",
      include: [
        "src/schema/**",
        "src/pipeline/**",
        "src/charts/**/*.ts",
        "src/voice/**",
        "src/audio/**",
        "src/captions/chunk.ts",
        "src/compose/wipe.ts",
        "src/map/**",
        "src/scenes/**/timing.ts",
        "src/scenes/**/layout.ts",
        "src/design/motion.ts",
        "src/design/layout.ts",
        "src/skill/**",
      ],
      exclude: ["src/pipeline/produce.ts", "src/pipeline/bundle.ts", "src/skill/sheetRender.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
