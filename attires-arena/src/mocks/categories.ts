import type { Category } from "@/types";

export const mockCategories: Category[] = [
  { id: "cat-shirts", slug: "shirts", name: "Shirts", description: "Oxford, linen, check and overshirts cut for Bangladesh's climate.", image: { src: "/images/categories/shirts.svg", alt: "Navy shirt" }, sortOrder: 1 },
  { id: "cat-pants", slug: "pants", name: "Pants", description: "Chinos, relaxed trousers, denim and cargos for every day.", image: { src: "/images/categories/pants.svg", alt: "Khaki chinos" }, sortOrder: 2 },
  { id: "cat-sneakers", slug: "sneakers", name: "Sneakers", description: "Clean, versatile sneakers that go with everything.", image: { src: "/images/categories/sneakers.svg", alt: "White sneaker" }, sortOrder: 3 },
  { id: "cat-belts", slug: "belts", name: "Belt", description: "Leather, reversible and woven belts to finish the look.", image: { src: "/images/categories/belts.svg", alt: "Brown leather belt" }, sortOrder: 4 },
  { id: "cat-wallets", slug: "wallets", name: "Wallets", description: "Slim wallets and card holders in full-grain leather.", image: { src: "/images/categories/wallets.svg", alt: "Brown bifold wallet" }, sortOrder: 5 },
  { id: "cat-watches", slug: "watches", name: "Watches", description: "Minimal and chronograph watches for work and weekend.", image: { src: "/images/categories/watches.svg", alt: "Chronograph watch" }, sortOrder: 6 },
];
