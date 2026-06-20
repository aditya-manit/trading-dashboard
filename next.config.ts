import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// Content-Security-Policy tuned to what the app actually loads:
//  - inline styles everywhere (style={}) → style-src 'unsafe-inline'
//  - Next injects inline bootstrap scripts → script-src 'unsafe-inline'
//    (+ 'unsafe-eval' only in dev for React Fast Refresh)
//  - Google avatar images (googleusercontent), Supabase auth (supabase.co)
//  - next/font is self-hosted → font-src 'self'
//  - frame-ancestors 'none' = anti-clickjacking
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self'",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${dev ? " ws://localhost:* http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
