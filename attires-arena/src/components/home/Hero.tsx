"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SmartImage } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Banner, HeroSettings } from "@/types";

function Slide({ banner, active, priority, uppercase }: { banner: Banner; active: boolean; priority: boolean; uppercase: boolean }) {
  const light = banner.tone === "light";
  return (
    <div className={cn("absolute inset-0 transition-opacity duration-700", active ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!active}>
      <SmartImage src={banner.image.src} alt={banner.image.alt} fill priority={priority} sizes="(min-width:1024px) 70vw, 100vw" className="object-cover object-[72%_center]" />
      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(20,10,8,${(banner.overlay ?? 30) / 100 + 0.25}) 0%, rgba(20,10,8,${(banner.overlay ?? 30) / 100}) 40%, rgba(20,10,8,0) 75%)` }} />
      <div className={cn("relative flex h-full flex-col justify-center px-6 sm:px-10 lg:px-14", light ? "text-white" : "text-ink")}>
        {banner.eyebrow && <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.35em] opacity-90 sm:text-xs">{banner.eyebrow}</p>}
        <h2 className={cn("max-w-[11ch] font-serif text-[44px] leading-[0.95] sm:text-6xl lg:text-[84px]", uppercase && "uppercase")}>
          {banner.title}
        </h2>
        {banner.subtitle && <p className="mt-4 max-w-sm text-sm opacity-90 sm:text-base lg:text-lg">{banner.subtitle}</p>}
        {banner.cta && (
          <Link href={banner.cta.href} tabIndex={active ? 0 : -1} className="mt-6 inline-flex h-11 w-fit items-center gap-2 rounded-control bg-primary px-6 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-lift transition-colors hover:bg-primary-dark sm:h-12 sm:px-7">
            {banner.cta.label} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

function SideTile({ banner }: { banner: Banner }) {
  return (
    <Link href={banner.cta?.href ?? "#"} className="group relative block overflow-hidden rounded-card bg-[#EDE8E2]">
      <SmartImage src={banner.image.src} alt={banner.image.alt} fill sizes="25vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
      <div className="relative flex h-full flex-col justify-center p-6 xl:p-8">
        <h2 className="max-w-[8ch] font-serif text-[30px] leading-[1.05] text-ink xl:text-[36px]">{banner.title}</h2>
        {banner.cta && (
          <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {banner.cta.label} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
          </span>
        )}
      </div>
    </Link>
  );
}

export function Hero({ hero, uppercase = true }: { hero: HeroSettings; uppercase?: boolean }) {
  const slides = hero.slides;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = useCallback((i: number) => setIndex((i + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (!hero.autoplayMs || paused || slides.length < 2) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), hero.autoplayMs);
    return () => window.clearInterval(t);
  }, [hero.autoplayMs, paused, slides.length]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  if (!slides.length) return null;

  return (
    <section aria-roledescription="carousel" aria-label="Featured collections" className="container pt-2 sm:pt-4">
      <div className={cn("grid gap-3 lg:gap-4", hero.side.length ? "lg:grid-cols-[2.6fr_1fr]" : "")}>
        <div className="relative h-[420px] overflow-hidden rounded-card bg-[#8E7B6B] sm:h-[460px] lg:h-[560px]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          {slides.map((s, i) => (
            <Slide key={s.id} banner={s} active={i === index} priority={i === 0} uppercase={uppercase} />
          ))}

          {/* Badges strip (desktop) */}
          {hero.badges.length > 0 && (
            <ul className="absolute bottom-5 left-6 hidden items-center gap-4 text-xs text-white/90 sm:left-10 md:flex lg:left-14">
              {hero.badges.map((b, i) => (
                <li key={b} className="flex items-center gap-4">
                  {i > 0 && <span className="h-3 w-px bg-white/40" aria-hidden />}
                  {b}
                </li>
              ))}
            </ul>
          )}

          {slides.length > 1 && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2 sm:bottom-5 sm:right-6">
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose slide">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Slide ${i + 1}: ${s.title}`}
                    onClick={() => go(i)}
                    className="flex h-6 items-center"
                  >
                    <span className={cn("block h-1.5 rounded-full transition-all", i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80")} />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => go(index - 1)} className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 sm:flex" aria-label="Previous slide">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => go(index + 1)} className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 sm:flex" aria-label="Next slide">
                <ChevronRight className="h-4 w-4" />
              </button>
              {hero.autoplayMs > 0 && (
                <button type="button" onClick={() => setPaused((p) => !p)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25" aria-label={paused ? "Play slideshow" : "Pause slideshow"}>
                  {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          )}
        </div>

        {hero.side.length > 0 && (
          <div className="hidden grid-rows-2 gap-4 lg:grid">
            {hero.side.slice(0, 2).map((b) => (
              <SideTile key={b.id} banner={b} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
