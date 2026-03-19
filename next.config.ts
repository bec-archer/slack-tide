import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'shop.qrstkr.com' }],
        destination: 'https://qrstkr.com/shop/:path*',
        permanent: false,
      },
    ]
  },
  async headers() {
    return [
      {
        // Shop pages should never serve stale cached JS after a deploy
        source: '/shop/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ]
  },
};

export default nextConfig;
