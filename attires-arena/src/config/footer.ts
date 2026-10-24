import type { FooterSettings } from "@/types";

export const footer: FooterSettings = {
  tagline: "Timeless menswear and accessories, curated for everyday confidence.",
  columns: [
    {
      title: "Shop",
      links: [
        { label: "All Products", href: "/shop" },
        { label: "New Arrivals", href: "/shop?sort=newest" },
        { label: "Categories", href: "/categories" },
        { label: "Brands", href: "/brands" },
        { label: "Offers", href: "/shop?offers=1" },
      ],
    },
    {
      title: "Help",
      links: [
        { label: "Track Order", href: "/track-order" },
        { label: "Shipping Policy", href: "/shipping-policy" },
        { label: "Returns & Exchange", href: "/return-policy" },
        { label: "FAQ", href: "/faq" },
        { label: "Contact Us", href: "/contact" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Us", href: "/about" },
        { label: "Privacy Policy", href: "/privacy-policy" },
        { label: "Terms & Conditions", href: "/terms" },
        { label: "My Account", href: "/account" },
      ],
    },
  ],
  // Placeholder contact details — replace before launch.
  contact: {
    phone: "+880 1XXX-XXXXXX",
    email: "support@attiresarena.com",
    address: "Dhaka, Bangladesh",
    hours: "Sat – Thu, 10:00 AM – 8:00 PM",
  },
  social: [
    { network: "facebook", href: "#" },
    { network: "instagram", href: "#" },
    { network: "youtube", href: "#" },
  ],
  paymentBadges: ["Cash on Delivery", "bKash", "Nagad", "Visa", "Mastercard"],
  copyright: "© {year} Attires Arena. All rights reserved.",
  newsletter: {
    enabled: true,
    title: "Join the Arena",
    description: "New drops, styling notes and members-only offers. No spam.",
  },
};
