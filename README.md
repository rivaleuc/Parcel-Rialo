# Parcel

Settlement infrastructure for physical delivery. The buyer locks USDC, the contract watches the carrier API by itself, and the funds release the moment the package is delivered. No keeper bots, no oracle stack, no human signing a "release" button.

Built on Rialo. The contract reads the carrier directly through Rialo's HTTPS Pulse and re-arms a native timer between checks. No oracle, no keeper, no relayer. The contract is the entire infrastructure.

## Why this exists

Cross-border commerce settles on trust and chargebacks. The buyer sends money, the seller ships, somebody waits. Crypto payments solved the rails but not the settlement: who decides the funds release when the package actually lands? Today that answer is a multisig, a keeper service, or an oracle network duct-taped onto a smart contract. Each one is a recurring cost and a point of failure.

Parcel treats settlement as a workflow that lives inside the chain. The contract polls the carrier directly, holds the funds, releases on delivered, refunds on timeout. One artifact, no off-chain dependencies.

## Lifecycle

```
  buyer locks USDC
        │
        ▼
   ┌─────────┐      carrier: in_transit      ┌────────────┐
   │ FUNDED  │ ────────────────────────────▶ │ IN TRANSIT │
   └─────────┘                               └────────────┘
        │                                        │
        │ deadline passes                        │ carrier: delivered
        ▼                                        ▼
   ┌──────────┐                            ┌────────────┐
   │ REFUNDED │                            │ DELIVERED  │
   │ → buyer  │                            │ → seller   │
   └──────────┘                            └────────────┘
```

The contract re-arms a native timer after every check and wakes itself back up. The carrier call goes through Rialo's HTTPS Pulse, a protocol-level HTTP instruction the network witnesses. Nothing outside the contract moves the state forward.

## What's in here

- `contracts/pay-on-delivery`: Rust contract expressing the escrow lifecycle against a Rialo-shaped runtime trait (`http_get_json`, `schedule_after`, token transfers). The real `rialo` crate gets wired in when the public testnet ships. Logic is covered by tests today.
- `packages/sdk`: TypeScript client. Simulation backend now, swaps to a Rialo RPC client later. The public interface stays the same.
- `web`: Next.js app to create escrows and watch them settle live, with a stage bar and an event timeline.

## Status

Rialo testnet is not public yet, and the `rialo` crate on crates.io is still a stub. So the contract logic is frozen against a runtime trait, and the SDK runs on a local simulator that polls a mock carrier. The product is demoable end to end today. The day the testnet opens, the only thing that changes is the runtime adapter: one Rust impl and one SDK backend.

Not done yet, on purpose: wallet connection, on-chain persistence, and the real Rialo runtime. All three wait on testnet access.
