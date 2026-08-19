import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@landfinder/ui", "@landfinder/domain", "@landfinder/financial-engine"],
};

export default nextConfig;
