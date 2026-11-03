import next from "eslint-config-next/core-web-vitals";
import globals from "globals";

const config = [
  {
    ignores: [
      ".next/**", "node_modules/**", "out/**", "build/**", "coverage/**",
      "next-env.d.ts", "public/sw.js", "public/offline.html", "public/icons/**",
    ],
  },
  ...next,
  {
    files: ["scripts/**/*.mjs", "tests/**/*.js", "tests/**/*.ts", "lib/**/*.js", "postcss.config.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "lib/**/*.ts", "tests/**/*.ts"],
    rules: {
      "@next/next/no-img-element": "error",
      /**
       * React Compiler's "set-state-in-effect" is advisory and conflicts with
       * three legitimate patterns used here: (1) client-side data loading on
       * mount, (2) reading browser-only APIs (navigator/localStorage) after
       * hydration to avoid SSR mismatches, and (3) resetting transient UI state
       * when the route changes. All other react-hooks rules stay enabled.
       */
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
