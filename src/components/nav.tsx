"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Current location must be visibly marked, not merely implied — otherwise
 * people lose track of where they are in a multi-page tool.
 */
export function Nav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/candidates", label: "Candidates" },
    ...(isAdmin ? [{ href: "/admin/users", label: "Team" }] : []),
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="flex gap-1" aria-label="Main">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/" || pathname.startsWith("/jobs")
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`relative inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium transition-colors duration-150 sm:px-3 ${
              active
                ? "bg-surface-2 text-ink"
                : "text-ink-muted hover:bg-surface-hover hover:text-ink"
            }`}
          >
            {link.label}
            {/* A gradient underline marks the current page — a small, deliberate
                flourish that grows in rather than blinking on. */}
            <span
              aria-hidden
              className={`brand-grad absolute inset-x-2.5 -bottom-px h-0.5 origin-left rounded-full transition-transform duration-300 ${
                active ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
