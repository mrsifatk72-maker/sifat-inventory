import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { CtaLink } from "@/types";
import { cn } from "@/lib/cn";

export function SectionHeading({ title, subtitle, cta, className, as: Tag = "h2" }: { title: string; subtitle?: string; cta?: CtaLink; className?: string; as?: "h1" | "h2" }) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4 sm:mb-7", className)}>
      <div>
        <Tag className="font-serif text-[26px] leading-tight text-ink sm:text-[34px]">{title}</Tag>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {cta && (
        <Link href={cta.href} className="group inline-flex shrink-0 items-center gap-1 pb-1 text-xs font-medium text-primary hover:text-primary-dark sm:text-sm">
          {cta.label}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
