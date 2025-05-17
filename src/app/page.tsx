import ItemsGrid from "@/components/itemsDisplay";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Suspense } from "react";

export default function Home() {
  return (
    <div className="app-container">
      <Header />
      <main>
        <Suspense fallback={<div>Loading items...</div>}>
          <ItemsGrid />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
