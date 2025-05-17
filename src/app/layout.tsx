import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GW2 Items Explorer",
  description: "Explore Guild Wars 2 items, recipes, and crafting materials",
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
        <div className="footer-section">
          <p className="footer-copyright">
            All game assets and content belong to ArenaNet and NCSOFT.
            <br />
            This is a fan-made website and is not affiliated with ArenaNet or NCSOFT.
          </p>
        </div>
        </footer>
      </body>
    </html>
  );
}
