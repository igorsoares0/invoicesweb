import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a tunnel (ngrok) load the dev server's scripts, e.g. to receive Paddle webhooks
  // and try the checkout from a public URL. Production ignores this.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.app"],
};

export default nextConfig;
