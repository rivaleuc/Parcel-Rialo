//! Pay-on-delivery escrow.
//!
//! Lifecycle:
//!   1. `init` locks USDC from the buyer and stores tracking metadata.
//!   2. The contract enters a reactive loop: it polls the carrier API,
//!      sleeps, and reacts.
//!   3. When the carrier reports `delivered`, funds release to the seller.
//!   4. If the deadline passes first, funds refund to the buyer.
//!
//! Why this shape: on Rialo, both the HTTP call and the sleep are native
//! protocol instructions. There is no keeper, no oracle, no relayer.
//! On every other chain this lifecycle needs three external services
//! glued to a vending-machine contract.
//!
//! The trait `RialoRuntime` in `runtime.rs` is the only thing that will
//! change when the public `rialo` crate ships. The escrow logic itself
//! is frozen.

pub mod runtime;

use runtime::{Address, CarrierStatus, RialoRuntime, RuntimeError, U64};

/// USDC mint address (placeholder, set per network at deploy time).
pub const USDC: Address = Address([0u8; 32]);

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Status {
    Funded,
    InTransit,
    Delivered,
    Refunded,
}

#[derive(Clone, Debug)]
pub struct EscrowState {
    pub buyer: Address,
    pub seller: Address,
    pub amount: U64,
    pub tracking: String,
    pub carrier_base_url: String,
    pub deadline: U64,
    pub status: Status,
    pub last_carrier_status: Option<String>,
}

#[derive(Debug)]
pub enum EscrowError {
    AlreadyResolved,
    Runtime(RuntimeError),
}

impl From<RuntimeError> for EscrowError {
    fn from(e: RuntimeError) -> Self {
        EscrowError::Runtime(e)
    }
}

/// One-shot setup: pull USDC into escrow, persist state, and kick off the
/// reactive workflow that polls the carrier on a schedule.
pub fn init<R: RialoRuntime>(
    rt: &mut R,
    buyer: Address,
    seller: Address,
    amount: U64,
    tracking: String,
    carrier_base_url: String,
    deadline: U64,
) -> Result<EscrowState, EscrowError> {
    rt.transfer_in(USDC, buyer, amount)?;

    let state = EscrowState {
        buyer,
        seller,
        amount,
        tracking,
        carrier_base_url,
        deadline,
        status: Status::Funded,
        last_carrier_status: None,
    };

    // First tick fires shortly after init, then the workflow re-arms itself.
    rt.schedule_after(POLL_INTERVAL_SECS)?;
    Ok(state)
}

/// Polling cadence. On real Rialo this is enforced by `schedule_after`,
/// which is a native runtime instruction.
pub const POLL_INTERVAL_SECS: U64 = U64(60 * 15); // 15 minutes

/// Reactive entry point. Called by the runtime each time the timer fires
/// or the carrier emits a webhook-like event. Idempotent.
pub fn on_tick<R: RialoRuntime>(
    rt: &mut R,
    state: &mut EscrowState,
) -> Result<(), EscrowError> {
    if matches!(state.status, Status::Delivered | Status::Refunded) {
        return Err(EscrowError::AlreadyResolved);
    }

    // 1. Ask the carrier directly. Native HTTP call, no oracle.
    let url = format!("{}/{}", state.carrier_base_url, state.tracking);
    let carrier = rt.http_get_json::<CarrierStatus>(&url)?;
    state.last_carrier_status = Some(carrier.status.clone());

    match carrier.status.as_str() {
        "delivered" => {
            rt.transfer_out(USDC, state.seller, state.amount)?;
            state.status = Status::Delivered;
            rt.emit("delivered", &state.tracking);
            return Ok(());
        }
        "picked_up" | "in_transit" => {
            state.status = Status::InTransit;
        }
        _ => {}
    }

    // 2. Deadline check. Refund if we ran out of patience.
    let now = rt.now();
    if now.0 >= state.deadline.0 {
        rt.transfer_out(USDC, state.buyer, state.amount)?;
        state.status = Status::Refunded;
        rt.emit("refunded", &state.tracking);
        return Ok(());
    }

    // 3. Sleep and try again. Native protocol instruction.
    rt.schedule_after(POLL_INTERVAL_SECS)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::mock::MockRuntime;

    fn addr(b: u8) -> Address {
        Address([b; 32])
    }

    #[test]
    fn delivered_path_releases_to_seller() {
        let mut rt = MockRuntime::new(1_000);
        rt.fund(addr(1), U64(100_000_000)); // 100 USDC
        rt.set_carrier_response("PKG-1", "in_transit");

        let mut state = init(
            &mut rt,
            addr(1),
            addr(2),
            U64(100_000_000),
            "PKG-1".into(),
            "https://carrier.example/track".into(),
            U64(1_000 + 86_400 * 30),
        )
        .unwrap();

        on_tick(&mut rt, &mut state).unwrap();
        assert_eq!(state.status, Status::InTransit);
        assert_eq!(rt.balance_of(addr(2)), U64(0));

        rt.set_carrier_response("PKG-1", "delivered");
        on_tick(&mut rt, &mut state).unwrap();

        assert_eq!(state.status, Status::Delivered);
        assert_eq!(rt.balance_of(addr(2)), U64(100_000_000));
        assert_eq!(rt.balance_of(addr(1)), U64(0));
    }

    #[test]
    fn deadline_refunds_buyer() {
        let mut rt = MockRuntime::new(1_000);
        rt.fund(addr(1), U64(50_000_000));
        rt.set_carrier_response("LOST-7", "unknown");

        let mut state = init(
            &mut rt,
            addr(1),
            addr(2),
            U64(50_000_000),
            "LOST-7".into(),
            "https://carrier.example/track".into(),
            U64(1_500),
        )
        .unwrap();

        rt.advance_to(U64(2_000));
        on_tick(&mut rt, &mut state).unwrap();

        assert_eq!(state.status, Status::Refunded);
        assert_eq!(rt.balance_of(addr(1)), U64(50_000_000));
        assert_eq!(rt.balance_of(addr(2)), U64(0));
    }
}
