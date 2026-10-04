import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@next/next/no-page-custom-font": "off", // false positive in the App Router root layout
      "@next/next/no-img-element": "off", // plain <img> on purpose: keeps the original sizes, crops and object-position
    },
  },
  globalIgnores(["dist/**", ".cloudflare/**", ".wrangler/**", "node_modules/**", "public/**", "scripts/**", "worker-configuration.d.ts"]),
]);
