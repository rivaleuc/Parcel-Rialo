import type { NextConfig } from "next";

// Privy lazy-loads a handful of optional integrations (Stripe onramp, Farcaster
// mini-app, React Native bits) that we do not use. They are not installed, so
// webpack reports them as missing. Alias them to an empty module so the build
// is deterministic across environments.
const OPTIONAL_MODULES = [
  "@stripe/crypto",
  "@stripe/stripe-js",
  "@farcaster/mini-app-solana",
  "@react-native-async-storage/async-storage",
];

const config: NextConfig = {
  transpilePackages: ["@parcel/sdk"],
  reactStrictMode: true,
  webpack: (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.alias = {
      ...(cfg.resolve.alias ?? {}),
      ...Object.fromEntries(OPTIONAL_MODULES.map((m) => [m, false])),
    };
    return cfg;
  },
};

export default config;
