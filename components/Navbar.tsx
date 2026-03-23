"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Studio" },
  { href: "/history", label: "History" },
  { href: "/library", label: "Library" },
  { href: "/onboarding", label: "Setup" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 flex h-12 shrink-0 items-center justify-between border-b border-[#27272a] bg-black px-6">
      <div className="flex items-center gap-2.5">
        <div className="h-4 w-4 rounded-sm bg-white" />
        <span className="text-sm font-semibold tracking-tight text-white">
          Product Studio
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              pathname === href
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
