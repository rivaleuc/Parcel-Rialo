import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/lib/auth";
import { AuthButton } from "./auth-button";
import { ThemeToggle } from "./theme-toggle";

// Set the theme class before paint to avoid a flash of the wrong mode.
const themeScript = `(function(){try{var t=localStorage.getItem("parcel.theme.v1");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Parcel — delivery-settled escrow on Rialo",
  description:
    "Buyer locks USDC, the contract polls the carrier itself, funds release on delivered. No keeper, no oracle.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
        <header
          className="border-b border-[color:var(--color-line)] backdrop-blur-sm sticky top-0 z-10"
          style={{ background: "color-mix(in srgb, var(--color-surface) 75%, transparent)" }}
        >
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5">
              <Logo />
              <span className="text-[17px] font-extrabold tracking-tight">Parcel</span>
            </a>
            <nav className="flex items-center gap-5 text-sm font-semibold text-[color:var(--color-ink-soft)]">
              <a href="/escrows" className="hover:text-[color:var(--color-ink)]">
                Escrows
              </a>
              <a href="/escrow/new" className="hover:text-[color:var(--color-ink)]">
                New escrow
              </a>
              <AuthButton />
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <div className="max-w-5xl mx-auto px-6 py-14">{children}</div>
        <footer className="max-w-5xl mx-auto px-6 py-10 border-t border-[color:var(--color-line)] mt-10">
          <p className="text-xs text-[color:var(--color-ink-faint)] font-medium">
            Parcel is settlement infrastructure, not a financial product. Built
            on Rialo. Escrow state is server-backed; on-chain settlement lands
            when the Rialo testnet opens.
          </p>
        </footer>
        </Providers>
      </body>
    </html>
  );
}

function Logo() {
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg"
      style={{ background: "var(--color-ink)" }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2.5 21 7v10l-9 4.5L3 17V7l9-4.5Z"
          stroke="var(--color-bg)"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M3 7l9 4.5L21 7M12 11.5V21" stroke="var(--color-bg)" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
