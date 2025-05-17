'use client';

import Link from 'next/link';
import './header.css';

export default function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <Link href="/">
            <h1>GW2 Items Explorer</h1>
          </Link>
        </div>
        <nav className="nav">
          <ul className="nav-list">
            <li><Link href="/" className="nav-link">Home</Link></li>
            <li><Link href="https://wiki.guildwars2.com/" target="_blank" className="nav-link">GW2 Wiki</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
} 