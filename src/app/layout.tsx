import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GW2 Items Explorer",
  description: "Explore Guild Wars 2 items, recipes, and crafting materials",
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main>
          {children}
        </main>
        <footer className="bg-gray-900 py-4 border-t-2 border-[#ff7700] mt-8">
          <div className="footer-section container mx-auto px-4">
            <p className="footer-copyright text-center text-sm md:text-base">
              All game assets and content belong to ArenaNet and NCSOFT.
              <br className="hidden md:block" />
              <span className="md:hidden"> </span>
              This is a fan-made website and is not affiliated with ArenaNet or NCSOFT.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
