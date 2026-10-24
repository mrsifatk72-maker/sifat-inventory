"use client";

import { Clock, Facebook, Instagram, Mail, MapPin, MessageCircle, Phone, Youtube } from "lucide-react";
import Link from "next/link";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { useStorefront } from "@/context/StorefrontContext";
import type { SocialLink } from "@/types";
import { Logo } from "./Logo";

const socialIcons: Record<SocialLink["network"], typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  tiktok: MessageCircle,
  whatsapp: MessageCircle,
};

export function Footer() {
  const { footer, demo } = useStorefront();
  return (
    <footer className="mt-16 bg-primary-dark pb-20 text-white md:pb-0">
      <div className="container py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr_1.3fr] lg:gap-12 [&>*]:min-w-0">
          <div>
            <Logo variant="inverse" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/70">{footer.tagline}</p>
            <ul className="mt-6 flex gap-2">
              {footer.social.map((s) => {
                const Icon = socialIcons[s.network];
                return (
                  <li key={s.network}>
                    <a href={s.href} aria-label={s.network} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-white hover:text-white">
                      <Icon className="h-4 w-4" aria-hidden />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footer.columns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{col.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link href={l.href} className="text-sm text-white/85 hover:text-white hover:underline">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="space-y-6">
            {footer.newsletter.enabled && (
              <div>
                <h2 className="font-serif text-2xl">{footer.newsletter.title}</h2>
                <p className="mt-1.5 text-sm text-white/70">{footer.newsletter.description}</p>
                <NewsletterForm tone="dark" className="mt-4" />
              </div>
            )}
            <ul className="space-y-2 text-sm text-white/75">
              <li className="flex items-center gap-2.5"><Phone className="h-4 w-4 shrink-0" aria-hidden />{footer.contact.phone}</li>
              <li className="flex items-center gap-2.5"><Mail className="h-4 w-4 shrink-0" aria-hidden />{footer.contact.email}</li>
              <li className="flex items-center gap-2.5"><MapPin className="h-4 w-4 shrink-0" aria-hidden />{footer.contact.address}</li>
              <li className="flex items-center gap-2.5"><Clock className="h-4 w-4 shrink-0" aria-hidden />{footer.contact.hours}</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/15 pt-6 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <p>{footer.copyright.replace("{year}", String(new Date().getFullYear()))}</p>
          <ul className="flex flex-wrap gap-2" aria-label="Payment methods">
            {footer.paymentBadges.map((b) => (
              <li key={b} className="rounded border border-white/20 px-2 py-1 text-[11px] text-white/80">
                {b}
              </li>
            ))}
          </ul>
        </div>
        {demo.showNotices && (
          <p className="mt-4 text-[11px] leading-relaxed text-white/45">
            Frontend demonstration: products, prices, reviews and brand listings are sample data. Brand names are shown for interface demonstration only and do not imply affiliation or authorised resale.
          </p>
        )}
      </div>
    </footer>
  );
}
