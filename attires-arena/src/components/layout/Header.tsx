"use client";

import { ChevronDown, Heart, Menu, Search, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { IconButton, Modal } from "@/components/ui";
import { useCart } from "@/context/CartContext";
import { useStorefront } from "@/context/StorefrontContext";
import { useWishlist } from "@/context/WishlistContext";
import { cn } from "@/lib/cn";
import { AnnouncementBar } from "./AnnouncementBar";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { SearchBar } from "./SearchBar";

export function Header() {
  const { header } = useStorefront();
  const pathname = usePathname();
  const { itemCount, openDrawer, hydrated } = useCart();
  const wishlist = useWishlist();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Links carrying a query (e.g. "/shop?sort=newest") are shortcuts and never shown as the active section.
  const isActive = (href: string) => !href.includes("?") && (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <AnnouncementBar />
      <header className={cn("z-40 border-b bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/90", header.sticky && "sticky top-0", scrolled ? "border-line shadow-[0_1px_0_rgba(0,0,0,0.02)]" : "border-transparent")}>
        <div className="container">
          <div className="grid h-[68px] grid-cols-[1fr_auto_1fr] items-center gap-2 lg:h-[92px] lg:gap-6">
            {/* Left: mobile menu / desktop nav */}
            <div className="flex items-center">
              <IconButton label="Open menu" className="-ml-2.5 lg:hidden" onClick={() => setMenuOpen(true)}>
                <Menu className="h-6 w-6" strokeWidth={1.6} />
              </IconButton>
              <nav aria-label="Main" className="hidden lg:block">
                <ul className="flex items-center gap-5 xl:gap-7">
                  {header.navigation.map((item) => (
                    <li key={item.label} className="group relative">
                      <Link
                        href={item.href}
                        className={cn(
                          "relative inline-flex items-center gap-1 py-2 text-[13px] tracking-wide transition-colors hover:text-primary",
                          isActive(item.href) ? "text-primary after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-primary" : item.highlight ? "text-primary" : "text-ink",
                        )}
                        aria-haspopup={item.children ? "true" : undefined}
                      >
                        {item.label}
                        {item.children && <ChevronDown className="h-3 w-3 opacity-60 transition-transform group-hover:rotate-180" aria-hidden />}
                      </Link>
                      {item.children && (
                        <div className="invisible absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                          <ul className="rounded-card border border-line bg-surface p-2 shadow-lift">
                            {item.children.map((c) => (
                              <li key={c.href}>
                                <Link href={c.href} className="block rounded px-3 py-2 text-sm text-ink hover:bg-selected hover:text-primary">
                                  {c.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {/* Center: logo */}
            <Logo priority />

            {/* Right: search + icons */}
            <div className="flex items-center justify-end gap-0.5 sm:gap-1">
              <SearchBar className="mr-2 hidden w-full max-w-[260px] xl:block" />
              <IconButton label="Search" className="hidden lg:inline-flex xl:hidden" onClick={() => setSearchOpen(true)}>
                <Search className="h-5 w-5" strokeWidth={1.6} />
              </IconButton>
              <Link href="/account" aria-label="Account" className="hidden h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-ink/5 sm:inline-flex">
                <User className="h-5 w-5" strokeWidth={1.6} />
              </Link>
              <Link href="/wishlist" aria-label={`Wishlist${wishlist.ids.length ? ` (${wishlist.ids.length})` : ""}`} className="relative hidden h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-ink/5 sm:inline-flex">
                <Heart className="h-5 w-5" strokeWidth={1.6} />
                {wishlist.hydrated && wishlist.ids.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" aria-hidden />}
              </Link>
              <IconButton label="Open cart" badge={hydrated ? itemCount : 0} onClick={openDrawer} className="-mr-2.5 sm:mr-0">
                <ShoppingBag className="h-5 w-5" strokeWidth={1.6} />
              </IconButton>
            </div>
          </div>

          {/* Mobile search row */}
          <div className="pb-3 lg:hidden">
            <SearchBar />
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <CartDrawer />
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Search" className="sm:max-w-xl">
        <SearchBar autoFocus onNavigate={() => setSearchOpen(false)} />
        <p className="mt-3 text-xs text-ink-muted">Try “linen”, “sneakers” or “maroon”.</p>
      </Modal>
    </>
  );
}
