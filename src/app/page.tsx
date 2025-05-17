import ItemsGrid from "@/components/itemsDisplay";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="app-container">
      <Header />
      <main>
        <ItemsGrid />
      </main>
      <Footer />
    </div>
  );
}
