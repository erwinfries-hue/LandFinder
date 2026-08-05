import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@landfinder/ui", "@landfinder/domain", "@landfinder/financial-engine", "@landfinder/scoring-engine"],
};

export default nextConfig;
