import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Green Hero Darajat | Admin",
  description: "Green Hero Darajat admin system",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="id" className={jakarta.className}><body suppressHydrationWarning>{children}</body></html>;
}
