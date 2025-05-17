'use client';

import { useState } from 'react';
import Link from 'next/link';
import './header.css';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <Link href="/">
            <h1>GW2 Items Explorer</h1>
          </Link>
        </div>
        
        {/* Мобільна кнопка меню */}
        <button 
          className="mobile-menu-button"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <span className={`menu-icon ${mobileMenuOpen ? 'open' : ''}`}></span>
        </button>
        
        {/* Навігація */}
        <nav className={`nav ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
          <ul className="nav-list">
            <li><Link href="/" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Home</Link></li>
            <li><Link href="https://wiki.guildwars2.com/" target="_blank" className="nav-link" onClick={() => setMobileMenuOpen(false)}>GW2 Wiki</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
} 