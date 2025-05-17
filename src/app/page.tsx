import ItemsGrid from "@/components/itemsDisplay";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Suspense } from "react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="app-container">
      <Header />
      <main>
        <div className="featured-links container mx-auto px-4 my-6">
          <Link href="/crafting" className="featured-link">
            <div className="bg-gradient-to-r from-blue-700 to-purple-700 text-white p-4 rounded-lg shadow-md hover:shadow-lg transition-all">
              <h2 className="text-xl font-bold mb-2">Crafting Recipes</h2>
              <p>Browse all available Guild Wars 2 crafting recipes and filter them by level and profession.</p>
            </div>
          </Link>
        </div>
        
        <Suspense fallback={<div>Loading items...</div>}>
          <ItemsGrid />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
