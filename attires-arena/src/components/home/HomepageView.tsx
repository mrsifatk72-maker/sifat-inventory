import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { BrandCard } from "@/components/brand/BrandCard";
import { CategoryCard } from "@/components/category/CategoryCard";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductRail } from "@/components/product/ProductRail";
import { Reveal, SectionHeading } from "@/components/ui";
import type { Brand, Category, HomepageSection, Product, StorefrontSettings } from "@/types";
import { CategoryBrandTabs, TopBrandsRow } from "./CategoryBrandTabs";
import { Hero } from "./Hero";
import { NewsletterSection } from "./NewsletterSection";
import { PromoBanners } from "./PromoBanners";
import { ValueProps } from "./ValueProps";

export interface HomepageData {
  categories: Category[];
  brands: Brand[];
  newArrivals: Product[];
  featured: Product[];
  bestSellers: Product[];
}

/** Major editorial sections get a one-time scroll reveal; individual product cards never animate in. */
const REVEAL_SECTIONS = new Set<HomepageSection["type"]>(["promo-banners", "featured", "best-sellers", "newsletter"]);

type HomepageSettings = Pick<StorefrontSettings, "homepage" | "hero" | "promoBanners" | "valueProps" | "footer" | "theme" | "logo">;

/**
 * Renders homepage sections in the configured order. Used by the real homepage
 * (server) and by the Appearance Editor preview (client) so both stay identical.
 */
export function HomepageView({ settings, data }: { settings: HomepageSettings; data: HomepageData }) {
  return (
    <div className="space-y-5 pb-4 sm:space-y-16 [&>*:nth-child(n+5)]:mt-10 sm:[&>*:nth-child(n+5)]:mt-16">
      {settings.homepage
        .filter((s) => s.enabled)
        .map((section) => (
          <div key={section.id} data-section={section.type} className={section.type === "value-props" ? "hidden sm:block" : undefined}>
            {REVEAL_SECTIONS.has(section.type) ? (
              <Reveal>
                <SectionRenderer section={section} settings={settings} data={data} />
              </Reveal>
            ) : (
              <SectionRenderer section={section} settings={settings} data={data} />
            )}
          </div>
        ))}
    </div>
  );
}

function SectionRenderer({ section, settings, data }: { section: HomepageSection; settings: HomepageSettings; data: HomepageData }) {
  const title = section.title ?? section.adminLabel;
  switch (section.type) {
    case "hero":
      return <Hero hero={settings.hero} uppercase={settings.theme.typography.headingUppercaseHero} logoSrc={settings.logo.primary} />;
    case "value-props":
      // Hidden on phones to match the mobile mockup (hero → Categories/Brands).
      return <div className="-mt-10"><ValueProps items={settings.valueProps} /></div>;
    case "categories":
      return (
        <section className="container" aria-label={title}>
          <div className="sm:hidden">
            <CategoryBrandTabs categories={data.categories} brands={data.brands} />
          </div>
          <SectionHeading title={title} subtitle={section.subtitle} cta={section.cta} className="hidden sm:flex" />
          <ul className="hidden gap-4 sm:grid sm:grid-cols-3 lg:grid-cols-6">
            {data.categories.map((c) => (
              <li key={c.id}>
                <CategoryCard category={c} />
              </li>
            ))}
          </ul>
        </section>
      );
    case "brands":
      return (
        <section className="container" aria-label={title}>
          <div className="sm:hidden">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-[22px] font-semibold text-ink">{section.mobileTitle ?? title}</h2>
              {section.cta && (
                <Link href={section.cta.href} className="flex items-center gap-1 pb-1 text-[13px] font-medium text-primary">
                  {section.cta.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </div>
            <TopBrandsRow brands={data.brands} />
          </div>
          <SectionHeading title={title} subtitle={section.subtitle} cta={section.cta} className="hidden sm:flex" />
          <ul className="hidden gap-4 sm:grid sm:grid-cols-3 lg:grid-cols-6">
            {data.brands.slice(0, 6).map((b) => (
              <li key={b.id} className="w-[38vw] max-w-[180px] shrink-0 sm:w-auto sm:max-w-none">
                <BrandCard brand={b} />
              </li>
            ))}
          </ul>
        </section>
      );
    case "new-arrivals":
      return (
        <section className="container" aria-label={title}>
          <SectionHeading title={title} subtitle={section.subtitle} cta={section.cta} />
          <ProductRail products={data.newArrivals.slice(0, section.limit ?? 6)} brands={data.brands} />
        </section>
      );
    case "featured":
      return (
        <section className="container" aria-label={title}>
          <SectionHeading title={title} subtitle={section.subtitle} cta={section.cta} />
          <ProductGrid products={data.featured.slice(0, section.limit ?? 8)} brands={data.brands} />
        </section>
      );
    case "best-sellers":
      return (
        <section className="container" aria-label={title}>
          <SectionHeading title={title} subtitle={section.subtitle} cta={section.cta} />
          <ProductGrid products={data.bestSellers.slice(0, section.limit ?? 4)} brands={data.brands} />
        </section>
      );
    case "promo-banners":
      return <PromoBanners banners={settings.promoBanners} />;
    case "newsletter":
      return <NewsletterSection title={settings.footer.newsletter.title} description={settings.footer.newsletter.description} />;
    default:
      return null;
  }
}
