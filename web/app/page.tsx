const CONTRACT_SNIPPET = `<span class="c-cm">// on_tick: the runtime wakes this on a timer</span>
<span class="c-kw">let</span> carrier = rt.<span class="c-fn">http_get_json</span>(&amp;url)?;

<span class="c-kw">match</span> carrier.status {
  <span class="c-str">"delivered"</span> =&gt; {
    rt.<span class="c-fn">transfer_out</span>(USDC, seller, amount)?;
    <span class="c-cm">// done, no relayer involved</span>
  }
  _ <span class="c-kw">if</span> rt.<span class="c-fn">now</span>() &gt;= deadline =&gt; {
    rt.<span class="c-fn">transfer_out</span>(USDC, buyer, amount)?;
  }
  _ =&gt; rt.<span class="c-fn">schedule_after</span>(POLL_INTERVAL)?,
}`;

export default function Home() {
  return (
    <main className="space-y-24">
      {/* Hero */}
      <section className="text-center">
        <div className="flex justify-center">
          <span className="pill">
            <span className="dot" />
            Built on Rialo
          </span>
        </div>
        <h1 className="mt-6 text-[44px] md:text-[58px] font-extrabold leading-[1.04] tracking-tight max-w-4xl mx-auto">
          Escrow that releases itself the moment your package is delivered.
        </h1>
        <p className="mt-6 text-lg md:text-xl text-[color:var(--color-ink-soft)] max-w-2xl mx-auto leading-relaxed">
          The buyer locks USDC. The contract reads the carrier directly
          through Rialo's HTTPS Pulse, holds the funds, pays the seller on
          delivery, refunds on timeout. No keeper bot, no oracle, no relayer.
        </p>
        <div className="mt-9 flex gap-3 justify-center">
          <a className="btn" href="/escrow/new">
            Create an escrow
          </a>
          <a className="btn btn-ghost" href="/escrows">
            View live escrows
          </a>
        </div>
        <p className="mt-5 text-sm text-[color:var(--color-ink-faint)]">
          Demo runs end to end on a local simulator. Wire to Rialo testnet when it opens.
        </p>
      </section>

      {/* Problem framing */}
      <section className="grid md:grid-cols-[1fr_1.1fr] gap-10 items-center">
        <div>
          <div className="eyebrow">The problem</div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Crypto fixed the rails, not the settlement.
          </h2>
          <p className="mt-4 text-[color:var(--color-ink-soft)] leading-relaxed">
            Money moves instantly. But who decides the funds release when a
            physical package actually lands? Today that answer is a multisig,
            a keeper service, or an oracle network bolted onto a dumb contract.
            Every extra service is a cost and a point of failure.
          </p>
        </div>
        <div className="card">
          <div className="text-sm font-semibold text-[color:var(--color-ink-faint)] mb-4">
            What it takes on a normal chain
          </div>
          <ul className="space-y-3 text-sm">
            {[
              ["Oracle network", "to read the carrier API"],
              ["Keeper / bot", "to poll on a schedule"],
              ["Relayer", "to wake the contract back up"],
              ["Multisig signer", "to approve the release"],
            ].map(([a, b]) => (
              <li key={a} className="flex items-start gap-3">
                <span className="text-[color:var(--color-ink-faint)] mt-0.5">✕</span>
                <span>
                  <span className="font-semibold">{a}</span>{" "}
                  <span className="text-[color:var(--color-ink-soft)]">{b}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 pt-5 border-t border-[color:var(--color-line)] flex items-center gap-3 text-sm">
            <span className="text-[color:var(--color-accent-ink)]">✓</span>
            <span className="font-semibold">On Rialo: one contract. That is the whole stack.</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <div className="text-center">
          <div className="eyebrow">How it works</div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Three moves, one artifact.
          </h2>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {[
            {
              n: "01",
              t: "Buyer locks funds",
              d: "USDC is pulled into the contract. The buyer attaches the carrier and tracking id, and a deadline for refund.",
            },
            {
              n: "02",
              t: "Contract watches the carrier",
              d: "Rialo's HTTPS Pulse reads the carrier endpoint every few minutes. The contract sleeps between checks and wakes itself.",
            },
            {
              n: "03",
              t: "It settles on its own",
              d: "On a delivered status the seller is paid. If the deadline passes first, the buyer is refunded. No one signs anything.",
            },
          ].map((s) => (
            <div key={s.n} className="card">
              <div className="text-2xl font-extrabold text-[color:var(--color-accent)] tracking-tight">
                {s.n}
              </div>
              <h3 className="mt-3 font-bold text-lg">{s.t}</h3>
              <p className="mt-2 text-sm text-[color:var(--color-ink-soft)] leading-relaxed">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Code teaser */}
      <section className="grid md:grid-cols-[1fr_1.2fr] gap-10 items-center">
        <div>
          <div className="eyebrow">The contract</div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            HTTPS Pulse and the timer, both native.
          </h2>
          <p className="mt-4 text-[color:var(--color-ink-soft)] leading-relaxed">
            Rialo lets a contract call the internet and sleep on a schedule as
            protocol-level instructions. The reactive loop below is the entire
            settlement engine. No middleware sits underneath it.
          </p>
        </div>
        <pre className="code-block" dangerouslySetInnerHTML={{ __html: CONTRACT_SNIPPET }} />
      </section>

      {/* Try the demo */}
      <section className="card bg-gradient-to-b from-white to-[color:var(--color-accent-wash)]">
        <div className="eyebrow">Try the demo</div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">
          Create an escrow and watch it settle live.
        </h2>
        <p className="mt-3 text-[color:var(--color-ink-soft)] max-w-2xl leading-relaxed">
          The detail page polls the mock carrier every few seconds, exactly the
          way the contract would on chain. Pick a tracking id to drive the
          outcome:
        </p>
        <div className="mt-5 grid sm:grid-cols-3 gap-3 text-sm">
          <CarrierHint code="DEMO-FAST-01" desc="Delivers in about 30 seconds." />
          <CarrierHint code="DEMO-SLOW-01" desc="Stays in transit much longer." />
          <CarrierHint code="LOST-7" desc="Never arrives, refunds on deadline." />
        </div>
        <div className="mt-7">
          <a className="btn" href="/escrow/new">
            Start a demo escrow
          </a>
        </div>
      </section>
    </main>
  );
}

function CarrierHint({ code, desc }: { code: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
      <span className="kbd">{code}</span>
      <p className="mt-2 text-[color:var(--color-ink-soft)]">{desc}</p>
    </div>
  );
}
