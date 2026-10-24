import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Placeholder artwork ships as local SVG. When real product photography is
    // served from Supabase Storage / a CDN, add its host to `remotePatterns`.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [],
  },
};

export default nextConfig;
