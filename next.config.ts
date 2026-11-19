import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // content markdown is read at seed/admin time, not bundled; resvg is a native module
  serverExternalPackages: ['pg', '@resvg/resvg-js'],
  // share cards rasterise with the app's own fonts
  outputFileTracingIncludes: {
    '/api/share/*': ['./assets/fonts/**/*'],
  },
};

export default nextConfig;
