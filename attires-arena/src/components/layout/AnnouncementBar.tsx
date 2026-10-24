"use client";

import Link from "next/link";
import { useStorefront } from "@/context/StorefrontContext";

export function AnnouncementBar() {
  const { header } = useStorefront();
  const { announcement } = header;
  if (!announcement.enabled || !announcement.items.length) return null;
  return (
    <div className="bg-primary text-white">
      <div className="container flex h-9 items-center justify-center text-[11px] tracking-wide sm:justify-between sm:text-xs">
        <p className="truncate">
          <span className="sm:hidden">{announcement.items[0]}</span>
          <span className="hidden sm:inline">
            {announcement.items.map((item, i) => (
              <span key={item}>
                {i > 0 && <span className="mx-3 opacity-50" aria-hidden>|</span>}
                {item}
              </span>
            ))}
          </span>
        </p>
        <nav aria-label="Utility" className="hidden items-center gap-5 sm:flex">
          {announcement.rightLinks.map((l) => (
            <Link key={l.href} href={l.href} className="opacity-90 hover:opacity-100 hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
