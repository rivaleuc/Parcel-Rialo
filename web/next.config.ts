import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@parcel/sdk"],
  reactStrictMode: true,
};

export default config;
