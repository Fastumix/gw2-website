import React, { useState } from 'react';
import Link from 'next/link';
import CacheManager from './CacheManager';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showCacheManager, setShowCacheManager] = useState(false);
  
  const toggleCacheManager = () => {
    setShowCacheManager(prev => !prev);
  };
  
  return (
    <div className="layout">
      <header className="layout-header">
        <div className="logo-container">
          <Link href="/" className="logo">
            Guild Wars 2 Companion
          </Link>
        </div>
        
        <nav className="main-nav">
          <ul>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/items">Items</Link>
            </li>
            <li>
              <Link href="/crafting">Crafting</Link>
            </li>
            <li>
              <Link href="/favorites">Favorites</Link>
            </li>
            <li>
              <button 
                className="cache-manager-button"
                onClick={toggleCacheManager}
              >
                Manage Cache
              </button>
            </li>
          </ul>
        </nav>
      </header>
      
      <main className="layout-content">
        {children}
      </main>
      
      <footer className="layout-footer">
        <div className="footer-content">
          <p>&copy; {new Date().getFullYear()} Guild Wars 2 Companion</p>
          <p>This is an unofficial fan site not affiliated with ArenaNet or NCSoft.</p>
          <div className="footer-links">
            <button 
              className="footer-cache-manager-link"
              onClick={toggleCacheManager}
            >
              Manage Data Cache
            </button>
          </div>
        </div>
      </footer>
      
      {showCacheManager && (
        <CacheManager onClose={() => setShowCacheManager(false)} />
      )}
    </div>
  );
};

export default Layout; 