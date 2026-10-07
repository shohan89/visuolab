import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

// A new value for every build: the page cache in src/worker.ts includes it in its keys, so HTML cached by an earlier deploy (which points at
// that deploy's hashed scripts and styles) is never served after a new deploy.
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  build: {
    // Ship the original CSS as written. The default minifier (Lightning CSS) rewrote `backdrop-filter` +
    // `-webkit-backdrop-filter` pairs to the prefixed property only, which removes the blur in Chromium
    // (About slider captions, nav menus). The stylesheets are small, so exactness wins over bytes.
    cssMinify: false,
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
