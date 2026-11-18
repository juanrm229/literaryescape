import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // content markdown is read at seed/admin time, not bundled
  serverExternalPackages: ['pg'],
};

export default nextConfig;
