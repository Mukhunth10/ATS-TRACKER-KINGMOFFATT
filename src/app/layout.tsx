import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { getSessionUser } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { btnGhost } from "@/components/ui";
import { logout } from "./login/actions";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // avoid invisible text while the font loads
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hirebase — Construction Recruitment",
  description: "Applicant tracking and CV screening for construction hiring",
};

// Explicit rather than relying on the framework default. maximumScale is left
// alone deliberately: capping zoom breaks accessibility for anyone who needs to
// enlarge text.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-ink">
        {/* Keyboard users should not have to tab through the whole header */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-fg"
        >
          Skip to content
        </a>

        <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
            <Link href="/" className="group flex min-h-11 shrink-0 items-center gap-2">
              <span
                aria-hidden
                className="brand-grad grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-white shadow-sm transition-transform duration-200 group-hover:scale-105"
              >
                H
              </span>
              {/* Wordmark is the first thing to go when width is tight */}
              <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">
                Hirebase
              </span>
            </Link>

            {user && <Nav isAdmin={user.role === "admin"} />}

            {user && (
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <div className="hidden text-right md:block">
                  <p className="text-sm leading-tight font-medium">{user.name}</p>
                  <p className="text-xs text-ink-subtle capitalize">{user.role}</p>
                </div>
                <span
                  aria-hidden
                  className="hidden h-8 w-8 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-ink-muted min-[380px]:grid"
                >
                  {user.name.slice(0, 2).toUpperCase()}
                </span>
                <form action={logout}>
                  {/* Icon-only below sm, but always labelled for screen readers
                      and kept at a 44px touch target. */}
                  <button
                    type="submit"
                    aria-label="Sign out"
                    className={`${btnGhost} min-h-11 px-2 sm:px-3`}
                  >
                    <span className="hidden sm:inline">Sign out</span>
                    <svg
                      aria-hidden
                      viewBox="0 0 20 20"
                      fill="none"
                      className="h-5 w-5 sm:hidden"
                    >
                      <path
                        d="M12 6V4.5A1.5 1.5 0 0 0 10.5 3h-5A1.5 1.5 0 0 0 4 4.5v11A1.5 1.5 0 0 0 5.5 17h5a1.5 1.5 0 0 0 1.5-1.5V14M9 10h8m0 0-2.5-2.5M17 10l-2.5 2.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>

        {/* Tighter gutters on phones; comfortable ones from tablet up */}
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
