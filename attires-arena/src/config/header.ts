import type { HeaderSettings } from "@/types";

export const header: HeaderSettings = {
  announcement: {
    enabled: true,
    items: ["Free delivery on orders over ৳2,000", "Cash on Delivery available", "Easy 7-day returns"],
    rightLinks: [
      { label: "Track Order", href: "/track-order" },
      { label: "Help", href: "/faq" },
    ],
  },
  searchPlaceholder: "Search for fashion, brands, styles...",
  sticky: true,
  navigation: [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    {
      label: "Categories",
      href: "/categories",
      children: [
        { label: "Shirts", href: "/category/shirts" },
        { label: "Pants", href: "/category/pants" },
        { label: "Sneakers", href: "/category/sneakers" },
        { label: "Belt", href: "/category/belts" },
        { label: "Wallet", href: "/category/wallets" },
        { label: "Watches", href: "/category/watches" },
      ],
    },
    { label: "Brands", href: "/brands" },
    { label: "New Arrivals", href: "/shop?sort=newest" },
    { label: "Offers", href: "/shop?offers=1", highlight: true },
  ],
};
