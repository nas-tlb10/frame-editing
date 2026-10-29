import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le rendu tourne dans un process enfant (hyperframes CLI), pas dans le bundle Next.
  serverExternalPackages: ["hyperframes"],
};

export default nextConfig;
