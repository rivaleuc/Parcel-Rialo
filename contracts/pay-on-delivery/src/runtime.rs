//! Runtime adapter.
//!
//! Today this trait is satisfied only by `mock::MockRuntime` used in tests.
//! Once the public `rialo` crate ships, we add a second impl backed by the
//! real chain primitives (`rialo::http`, `rialo::schedule`, `rialo::token`).
//! No call site in `lib.rs` needs to change.

#[derive(Copy, Clone, Debug, Default, PartialEq, Eq, Hash)]
pub struct Address(pub [u8; 32]);

#[derive(Copy, Clone, Debug, Default, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct U64(pub u64);

#[derive(Clone, Debug)]
pub struct CarrierStatus {
    pub status: String,
}

#[derive(Debug)]
pub enum RuntimeError {
    InsufficientBalance,
    HttpFailed(String),
    Other(String),
}

/// Anything Rialo exposes to a contract that we touch.
pub trait RialoRuntime {
    /// Current unix seconds.
    fn now(&self) -> U64;

    /// Move tokens from `from` into the contract's vault.
    fn transfer_in(&mut self, mint: Address, from: Address, amount: U64) -> Result<(), RuntimeError>;

    /// Move tokens from the contract's vault to `to`.
    fn transfer_out(&mut self, mint: Address, to: Address, amount: U64) -> Result<(), RuntimeError>;

    /// Native HTTP GET that returns JSON. On Rialo this is a consensus-level
    /// instruction; the network witnesses the response.
    fn http_get_json<T: FromJson>(&mut self, url: &str) -> Result<T, RuntimeError>;

    /// Native scheduler. The runtime wakes the contract back up after the
    /// given delay and calls `on_tick`.
    fn schedule_after(&mut self, delay_secs: U64) -> Result<(), RuntimeError>;

    /// Emit a log line for off-chain consumers (UI, indexers).
    fn emit(&mut self, topic: &str, payload: &str);
}

/// Minimal JSON deserialization shim so the trait stays dependency-free.
/// The real impl will use whatever the rialo crate ships (likely serde).
pub trait FromJson: Sized {
    fn from_json(s: &str) -> Result<Self, RuntimeError>;
}

impl FromJson for CarrierStatus {
    fn from_json(s: &str) -> Result<Self, RuntimeError> {
        // Tiny hand-rolled extractor for `"status":"..."`. Replaced by serde
        // in the real runtime impl.
        let key = "\"status\"";
        let i = s.find(key).ok_or_else(|| RuntimeError::Other("no status".into()))?;
        let after = &s[i + key.len()..];
        let colon = after.find(':').ok_or_else(|| RuntimeError::Other("malformed".into()))?;
        let rest = after[colon + 1..].trim_start();
        let rest = rest.strip_prefix('"').ok_or_else(|| RuntimeError::Other("malformed".into()))?;
        let end = rest.find('"').ok_or_else(|| RuntimeError::Other("malformed".into()))?;
        Ok(CarrierStatus { status: rest[..end].to_string() })
    }
}

#[cfg(test)]
pub mod mock {
    use super::*;
    use std::collections::HashMap;

    pub struct MockRuntime {
        clock: U64,
        balances: HashMap<Address, U64>,
        vault: U64,
        carrier_responses: HashMap<String, String>,
        pub events: Vec<(String, String)>,
        pub scheduled: Vec<U64>,
    }

    impl MockRuntime {
        pub fn new(start_unix: u64) -> Self {
            Self {
                clock: U64(start_unix),
                balances: HashMap::new(),
                vault: U64(0),
                carrier_responses: HashMap::new(),
                events: vec![],
                scheduled: vec![],
            }
        }

        pub fn fund(&mut self, who: Address, amount: U64) {
            self.balances.insert(who, amount);
        }

        pub fn balance_of(&self, who: Address) -> U64 {
            self.balances.get(&who).copied().unwrap_or_default()
        }

        pub fn set_carrier_response(&mut self, tracking: &str, status: &str) {
            self.carrier_responses.insert(tracking.into(), status.into());
        }

        pub fn advance_to(&mut self, t: U64) {
            self.clock = t;
        }
    }

    impl RialoRuntime for MockRuntime {
        fn now(&self) -> U64 {
            self.clock
        }

        fn transfer_in(&mut self, _mint: Address, from: Address, amount: U64) -> Result<(), RuntimeError> {
            let bal = self.balances.get(&from).copied().unwrap_or_default();
            if bal.0 < amount.0 {
                return Err(RuntimeError::InsufficientBalance);
            }
            self.balances.insert(from, U64(bal.0 - amount.0));
            self.vault = U64(self.vault.0 + amount.0);
            Ok(())
        }

        fn transfer_out(&mut self, _mint: Address, to: Address, amount: U64) -> Result<(), RuntimeError> {
            if self.vault.0 < amount.0 {
                return Err(RuntimeError::InsufficientBalance);
            }
            self.vault = U64(self.vault.0 - amount.0);
            let bal = self.balances.get(&to).copied().unwrap_or_default();
            self.balances.insert(to, U64(bal.0 + amount.0));
            Ok(())
        }

        fn http_get_json<T: FromJson>(&mut self, url: &str) -> Result<T, RuntimeError> {
            // Pull the tracking id from the tail of the URL.
            let tracking = url.rsplit('/').next().unwrap_or("");
            let status = self
                .carrier_responses
                .get(tracking)
                .cloned()
                .unwrap_or_else(|| "unknown".to_string());
            T::from_json(&format!("{{\"status\":\"{}\"}}", status))
        }

        fn schedule_after(&mut self, delay_secs: U64) -> Result<(), RuntimeError> {
            self.scheduled.push(U64(self.clock.0 + delay_secs.0));
            Ok(())
        }

        fn emit(&mut self, topic: &str, payload: &str) {
            self.events.push((topic.into(), payload.into()));
        }
    }
}
