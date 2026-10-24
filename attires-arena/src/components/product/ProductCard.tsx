"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Price, Rating, SmartImage } from "@/components/ui";
import { useStorefront } from "@/context/StorefrontContext";
import { cn } from "@/lib/cn";
import { discountPercent } from "@/lib/format";
import { imagesForColor, totalStock } from "@/lib/product";
import type { Product } from "@/types";
import { ColorSwatches } from "./ColorSwatches";
import { QuickAddModal } from "./QuickAddModal";
import { WishlistButton } from "./WishlistButton";

export interface ProductCardProps {
  product: Product;
  brandName?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}

export function ProductCard({ product, brandName, priority, sizes = "(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw", className }: ProductCardProps) {
  const { productCard: cfg } = useStorefront();
  const [colorId, setColorId] = useState(product.colors[0]?.id);
  const [quickAdd, setQuickAdd] = useState(false);
  const images = imagesForColor(product, colorId);
  const main = images[0];
  const hover = images[1];
  const off = discountPercent(product.price, product.compareAtPrice);
  const soldOut = totalStock(product) === 0;
  const href = `/product/${product.slug}${colorId && colorId !== product.colors[0]?.id ? `?color=${colorId}` : ""}`;

  return (
    <article className={cn("group relative", className)}>
      <div className={cn("relative overflow-hidden rounded-card", cfg.imageAspect === "portrait" ? "aspect-[4/5]" : "aspect-square")} style={{ backgroundColor: cfg.imageBackground }}>
        <Link href={href} aria-label={product.name} className="absolute inset-0">
          {/* Hover (pointer devices only): gentle 1.05 zoom + cross-fade to the secondary image. */}
          <span className="absolute inset-0 transition-transform duration-[450ms] ease-out will-change-transform [@media(hover:hover)]:group-hover:scale-[1.05]">
            {main && <SmartImage src={main.src} alt={main.alt} fill priority={priority} sizes={sizes} className={cn("object-cover transition-opacity duration-[400ms] ease-out", hover && "[@media(hover:hover)]:group-hover:opacity-0")} />}
            {hover && <SmartImage src={hover.src} alt="" fill sizes={sizes} className="object-cover opacity-0 transition-opacity duration-[400ms] ease-out [@media(hover:hover)]:group-hover:opacity-100" />}
          </span>
        </Link>
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
          {soldOut ? (
            <Badge tone="dark">Sold out</Badge>
          ) : (
            <>
              {cfg.showDiscountBadge && off > 0 && <Badge>{off}% off</Badge>}
              {product.badges.includes("new") && <Badge tone="outline">New</Badge>}
              {product.badges.includes("limited") && <Badge tone="dark">Limited</Badge>}
            </>
          )}
        </div>
        {cfg.showWishlist && <WishlistButton productId={product.id} productName={product.name} className="absolute right-2.5 top-2.5" />}
        {cfg.showQuickAdd && !soldOut && (
          // Desktop pointer devices reveal it on hover; keyboard users get it on focus.
          // Touch devices simply tap the card to open the product page (no hover-only features).
          <button
            type="button"
            onClick={() => setQuickAdd(true)}
            aria-label={`Quick view: ${product.name}`}
            className="absolute inset-x-2.5 bottom-2.5 hidden h-10 translate-y-2 items-center justify-center gap-1.5 rounded-control bg-surface/95 text-xs font-medium text-ink opacity-0 shadow-sm backdrop-blur transition-[opacity,transform,background-color,color] duration-300 ease-out hover:bg-primary hover:text-white focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 [@media(hover:hover)]:md:flex"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden /> Quick View
          </button>
        )}
      </div>
      <div className="mt-3 space-y-1.5 px-0.5">
        {cfg.showBrand && brandName && <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">{brandName}</p>}
        <h3 className="line-clamp-1 text-[13px] text-ink sm:text-sm">
          <Link href={href} className="hover:text-primary">
            {product.name}
          </Link>
        </h3>
        <Price price={product.price} compareAt={product.compareAtPrice} />
        {cfg.showRating && <Rating value={product.rating.average} count={product.rating.count} />}
        {cfg.showColorSwatches && product.colors.length > 1 && <ColorSwatches colors={product.colors} activeId={colorId} onHover={setColorId} />}
      </div>
      <QuickAddModal open={quickAdd} product={product} brandName={brandName} initialColorId={colorId} onClose={() => setQuickAdd(false)} />
    </article>
  );
}
