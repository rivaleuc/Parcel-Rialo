# Parcel

Settlement infrastructure for physical delivery. Buyer locks USDC, the contract watches the carrier API itself, and funds release the moment the package is delivered. No keeper bots, no oracle stack, no human signing a "release" button.

Built on Rialo because Rialo is the only L1 where a smart contract can call an HTTP endpoint and sleep for thirty days without external middleware. The contract is the entire infrastructure.

## Why this exists

Cross-border commerce settles on trust and chargebacks. Buyer sends money, seller ships, somebody waits. Crypto payments solve the rails but not the settlement: who decides the funds release when the package lands? Today the answer is a multisig, a keeper service, or an oracle network duct-taped to a smart contract. Each one is a point of failure and a recurring cost.

Parcel treats settlement as a workflow that lives inside the chain. The contract polls the carrier directly, holds the funds, releases on delivered, refunds on timeout. One artifact. No off-chain dependencies.

## What's in here

- `contracts/pay-on-delivery` — Rust contract expressing the escrow lifecycle against a Rialo-shaped runtime trait. Real `rialo` crate gets wired in when public testnet ships.
- `web` — Next.js app for creating escrows and watching status.
- `packages/sdk` — TypeScript client. Simulation backend today, swaps to Rialo RPC when available.

## Status

Rialo testnet is not yet public. The contract logic is frozen; the SDK runs against a local simulator so the product is demoable end to end. The day the testnet opens, only the runtime adapter changes.
