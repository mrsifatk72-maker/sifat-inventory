import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { ThemeStyle } from "@/components/theme/ThemeStyle";
import { CartProvider } from "@/context/CartContext";
import { StorefrontProvider } from "@/context/StorefrontContext";
import { ToastProvider } from "@/context/ToastContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { getInitialCart, getStorefrontSettings } from "@/services";
import "./globals.css";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getStorefrontSettings();
  return {
    metadataBase: new URL(s.siteUrl),
    title: { default: `${s.siteName} — Premium Menswear in Bangladesh`, template: `%s | ${s.siteName}` },
    description: s.description,
    icons: { icon: "/brand/icon.png", apple: "/brand/apple-icon.png" },
    openGraph: { siteName: s.siteName, type: "website", images: [{ url: s.logo.badge }] },
  };
}

export const viewport: Viewport = {
  themeColor: "#6B0202",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, initialCart] = await Promise.all([getStorefrontSettings(), getInitialCart()]);
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <head>
        <ThemeStyle theme={settings.theme} />
      </head>
      <body>
        <StorefrontProvider settings={settings}>
          <ToastProvider>
            <WishlistProvider>
              <CartProvider initialItems={initialCart}>
                <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-white">
                  Skip to content
                </a>
                {children}
              </CartProvider>
            </WishlistProvider>
          </ToastProvider>
        </StorefrontProvider>
      </body>
    </html>
  );
}
