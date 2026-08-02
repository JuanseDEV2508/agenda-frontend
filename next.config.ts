import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El proyecto convive con otros lockfiles en carpetas superiores; se fija la
  // raíz para que Turbopack no la infiera incorrectamente.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
