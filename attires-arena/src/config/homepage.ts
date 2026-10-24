import type { Banner, HeroSettings, HomepageSection, ValueProp } from "@/types";

export const hero: HeroSettings = {
  autoplayMs: 6000,
  badges: ["Premium Quality", "Curated Collections", "Designed for Everyday"],
  slides: [
    {
      id: "hero-style-elevated",
      eyebrow: "New Season",
      title: "Style Elevated",
      subtitle: "Timeless fashion for the modern you.",
      cta: { label: "Shop Now", href: "/shop" },
      image: { src: "/images/banners/hero-style-elevated.svg", alt: "Maroon overshirt styled with beige trousers" },
      // Phone layout from the approved mobile mockup.
      titleAccent: "Elevated",
      tagline: "Premium Fashion|Thrift Shopping",
      script: "Quality|Styles|Better|Choices",
      mobileImage: { src: "/images/mockup/hero-rack.jpg", alt: "Clothing rack with shirts and an Attires Arena cap" },
      showLogo: true,
      align: "left",
      tone: "light",
      overlay: 35,
    },
    {
      id: "hero-tonal",
      eyebrow: "The Neutrals Edit",
      title: "Quiet Luxury",
      subtitle: "Soft tones, clean lines, everyday ease.",
      cta: { label: "Explore Shirts", href: "/category/shirts" },
      image: { src: "/images/banners/hero-quiet-luxury.svg", alt: "Neutral shirts and trousers flat lay" },
      align: "left",
      tone: "light",
      overlay: 30,
    },
    {
      id: "hero-footwear",
      eyebrow: "Step Forward",
      title: "Clean Kicks",
      subtitle: "Minimal sneakers built for long city days.",
      cta: { label: "Shop Sneakers", href: "/category/sneakers" },
      image: { src: "/images/banners/hero-clean-kicks.svg", alt: "White leather sneakers" },
      align: "left",
      tone: "light",
      overlay: 30,
    },
  ],
  side: [
    {
      id: "side-new-arrivals",
      title: "New Arrivals",
      cta: { label: "Explore", href: "/shop?sort=newest" },
      image: { src: "/images/banners/side-new-arrivals.svg", alt: "New season jackets" },
      align: "left",
      tone: "dark",
    },
    {
      id: "side-footwear",
      title: "Essential Footwear",
      cta: { label: "Shop Now", href: "/category/sneakers" },
      image: { src: "/images/banners/side-footwear.svg", alt: "White sneakers" },
      align: "left",
      tone: "dark",
    },
  ],
};

export const promoBanners: Banner[] = [
  {
    id: "promo-tonal",
    title: "Tonal Essentials",
    subtitle: "Minimal collection for maximum style.",
    cta: { label: "Discover", href: "/shop?colors=beige,stone,olive" },
    image: { src: "/images/banners/promo-tonal.svg", alt: "Stack of folded neutral shirts" },
    align: "left",
    tone: "dark",
  },
  {
    id: "promo-comfort",
    title: "Everyday Comfort",
    subtitle: "Elevated style for daily moments.",
    cta: { label: "Shop Now", href: "/category/pants" },
    image: { src: "/images/banners/promo-comfort.svg", alt: "Relaxed trousers and loafers" },
    align: "left",
    tone: "dark",
  },
];

export const valueProps: ValueProp[] = [
  { icon: "sparkles", title: "Premium Quality", description: "Curated collection" },
  { icon: "banknote", title: "Cash on Delivery", description: "Across Bangladesh" },
  { icon: "rotate-ccw", title: "Easy Returns", description: "Hassle-free, 7 days" },
  { icon: "lock", title: "Secure Shopping", description: "Your data is safe" },
];

/**
 * Homepage section order and visibility. Re-order the array to re-order the page.
 * Toggle `enabled` to hide a section without deleting its settings.
 */
export const homepageSections: HomepageSection[] = [
  { id: "hero", type: "hero", adminLabel: "Hero banner", enabled: true },
  { id: "value-props", type: "value-props", adminLabel: "Value propositions", enabled: true },
  { id: "categories", type: "categories", adminLabel: "Shop by Category", enabled: true, title: "Shop by Category", cta: { label: "View All", href: "/categories" } },
  { id: "brands", type: "brands", adminLabel: "Shop by Brand", enabled: true, title: "Shop by Brand", mobileTitle: "Top Brands", cta: { label: "See All", href: "/brands" } },
  { id: "new-arrivals", type: "new-arrivals", adminLabel: "New Arrivals", enabled: true, title: "New Arrivals", cta: { label: "View All", href: "/shop?sort=newest" }, limit: 6 },
  { id: "promo-banners", type: "promo-banners", adminLabel: "Promotional banners", enabled: true },
  { id: "featured", type: "featured", adminLabel: "Featured Products", enabled: true, title: "Featured Products", subtitle: "Hand-picked pieces our stylists love this month.", cta: { label: "Shop All", href: "/shop" }, limit: 8 },
  { id: "best-sellers", type: "best-sellers", adminLabel: "Best Sellers", enabled: true, title: "Best Sellers", cta: { label: "View All", href: "/shop?sort=rating" }, limit: 4 },
  { id: "newsletter", type: "newsletter", adminLabel: "Newsletter", enabled: true },
];
