import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Environment variables
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  },
  
  // CORS Headers
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" }
        ]
      }
    ];
  },

  // Add security headers
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          has: [{ type: 'header', key: 'x-skip-middleware' }],
          destination: '/api/:path*',
        },
      ],
      afterFiles: [],
      fallback: []
    };
  },
};

export default nextConfig;