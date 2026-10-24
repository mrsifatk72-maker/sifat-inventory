import { BrandCard } from "@/components/brand/BrandCard";
import { CategoryCard } from "@/components/category/CategoryCard";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductRail } from "@/components/product/ProductRail";
import { SectionHeading } from "@/components/ui";
import type { Brand, Category, HomepageSection, Product, StorefrontSettings } from "@/types";
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

type HomepageSettings = Pick<StorefrontSettings, "homepage" | "hero" | "promoBanners" | "valueProps" | "footer" | "theme">;

/**
 * Renders homepage sections in the configured order. Used by the real homepage
 * (server) and by the Appearance Editor preview (client) so both stay identical.
 */
export function HomepageView({ settings, data }: { settings: HomepageSettings; data: HomepageData }) {
  return (
    <div className="space-y-12 pb-4 sm:space-y-16">
      {settings.homepage
        .filter((s) => s.enabled)
        .map((section) => (
          <div key={section.id} data-section={section.type}>
            <SectionRenderer section={section} settings={settings} data={data} />
          </div>
        ))}
    </div>
  );
}

function SectionRenderer({ section, settings, data }: { section: HomepageSection; settings: HomepageSettings; data: HomepageData }) {
  const title = section.title ?? section.adminLabel;
  switch (section.type) {
    case "hero":
      return <Hero hero={settings.hero} uppercase={settings.theme.typography.headingUppercaseHero} />;
    case "value-props":
      return <div className="-mt-6 sm:-mt-10"><ValueProps items={settings.valueProps} /></div>;
    case "categories":
      return (
        <section className="container" aria-label={title}>
          <SectionHeading title={title} subtitle={section.subtitle} cta={section.cta} />
          <ul className="grid grid-cols-4 gap-x-2 gap-y-5 sm:hidden">
            {data.categories.map((c) => (
              <li key={c.id}>
                <CategoryCard category={c} variant="circle" />
              </li>
            ))}
          </ul>
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
          <SectionHeading title={title} subtitle={section.subtitle} cta={section.cta} />
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
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
