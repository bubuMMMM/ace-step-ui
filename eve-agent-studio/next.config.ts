import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { withEve } from "eve/next";

const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // This app is self-contained. Pinning the root stops Turbopack from inferring
  // a parent directory as the workspace when one happens to sit above it.
  turbopack: { root: here },
};

// The studio's own eve agent (the "architect") is mounted at /eve/v1/* by
// withEve, so the browser talks to it same-origin with no CORS and no env URL.
//
// EVE_DISABLED=1 builds the studio as a pure static generator: the builder and
// the project export keep working, only the AI assist panel goes away. It is an
// escape hatch for environments that cannot run the agent build.
export default process.env.EVE_DISABLED === "1" ? nextConfig : withEve(nextConfig);
