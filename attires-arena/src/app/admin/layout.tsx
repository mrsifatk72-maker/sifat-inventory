import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/**
 * Admin area (frontend only). Codex: protect this segment with an admin role
 * check (middleware or a server-side session check) during integration.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
