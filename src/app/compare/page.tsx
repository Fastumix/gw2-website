'use client';

import { useState, useEffect } from 'react';
import { fetchItem } from '@/services/gw2api';
import { Item } from '@/types/gw2api';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import '../globals.css';
import './compare.css';

export default function ComparePage() {
  const searchParams = useSearchParams();
  const item1Id = searchParams.get('item1');
  const item2Id = searchParams.get('item2');
  
  const [item1, setItem1] = useState<Item | null>(null);
  const [item2, setItem2] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function loadItems() {
      setLoading(true);
      setError(null);
      
      try {
        if (item1Id) {
          const item1Data = await fetchItem(parseInt(item1Id));
          setItem1(item1Data);
        }
        
        if (item2Id) {
          const item2Data = await fetchItem(parseInt(item2Id));
          setItem2(item2Data);
        }
      } catch (err) {
        console.error('Error loading items for comparison:', err);
        setError(`Error loading items: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }
    
    loadItems();
  }, [item1Id, item2Id]);
  
  // Format currency values
  const formatCurrency = (value: number): string => {
    const gold = Math.floor(value / 10000);
    const silver = Math.floor((value % 10000) / 100);
    const copper = value % 100;
    
    return `${gold ? gold + 'g ' : ''}${silver ? silver + 's ' : ''}${copper}c`;
  };
  
  // Calculate and determine the better stats
  const compareValues = (val1: number, val2: number, higherIsBetter = true): [string, string] => {
    if (val1 === val2) return ['', ''];
    
    if (higherIsBetter) {
      return val1 > val2 ? ['highlight-better', 'highlight-worse'] : ['highlight-worse', 'highlight-better'];
    } else {
      return val1 < val2 ? ['highlight-better', 'highlight-worse'] : ['highlight-worse', 'highlight-better'];
    }
  };
  
  if (loading) {
    return (
      <div className="compare-loading">
        <div className="compare-spinner"></div>
        <p>Loading items for comparison...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="compare-error">
        <h2>Error</h2>
        <p>{error}</p>
        <Link href="/" className="back-link">Return to Home</Link>
      </div>
    );
  }
  
  // Helper function to get source information
  const getItemSource = (item: Item): string => {
    if (item.flags.includes('AccountBound')) {
      return 'Account Bound - Reward from achievements or events';
    } else if (item.type === 'CraftingMaterial') {
      return 'Gathering or monster drops';
    } else if (item.type === 'Consumable') {
      return 'Merchants or Trading Post';
    } else if (item.rarity === 'Legendary') {
      return 'Legendary crafting or achievements';
    } else if (item.rarity === 'Exotic' || item.rarity === 'Ascended') {
      return 'Crafting, dungeons or world bosses';
    } else {
      return 'Trading Post, merchants or drops';
    }
  };
  
  return (
    <div className="compare-container">
      <div className="compare-header">
        <Link href="/" className="back-button">← Back</Link>
        <h1 className="compare-title">Item Comparison</h1>
      </div>
      
      {(item1Id && !item2Id) && (
        <div className="compare-instructions">
          <p>You've selected the first item to compare. Now choose a second item from our catalog:</p>
          <Link href={`/?compare=${item1Id}`} className="compare-button">
            Select Second Item
          </Link>
        </div>
      )}
      
      {(!item1Id && !item2Id) && (
        <div className="compare-instructions">
          <p>To compare items, select two items from our catalog by going to the home page:</p>
          <Link href="/" className="compare-button">
            Select Items to Compare
          </Link>
        </div>
      )}
      
      {item1Id && item2Id && (
        <div className="comparison-table-container">
          {item1 && item2 ? (
            <>
              <div className="comparison-header">
                <div className="comparison-item-header">
                  {item1.icon && (
                    <Image 
                      src={item1.icon}
                      alt={item1.name}
                      width={64}
                      height={64}
                      className={`compare-item-icon rarity-${item1.rarity.toLowerCase()}`}
                    />
                  )}
                  <Link href={`/items/${item1.id}`} className={`item-name text-${item1.rarity.toLowerCase()}`}>
                    {item1.name}
                  </Link>
                </div>
                <div className="comparison-vs">VS</div>
                <div className="comparison-item-header">
                  {item2.icon && (
                    <Image 
                      src={item2.icon}
                      alt={item2.name}
                      width={64}
                      height={64}
                      className={`compare-item-icon rarity-${item2.rarity.toLowerCase()}`}
                    />
                  )}
                  <Link href={`/items/${item2.id}`} className={`item-name text-${item2.rarity.toLowerCase()}`}>
                    {item2.name}
                  </Link>
                </div>
              </div>
              
              <table className="comparison-table">
                <tbody>
                  <tr>
                    <td>Type</td>
                    <td>{item1.type}</td>
                    <td>{item2.type}</td>
                  </tr>
                  <tr>
                    <td>Rarity</td>
                    <td className={`text-${item1.rarity.toLowerCase()}`}>{item1.rarity}</td>
                    <td className={`text-${item2.rarity.toLowerCase()}`}>{item2.rarity}</td>
                  </tr>
                  
                  {/* Level comparison with highlights */}
                  {(() => {
                    const [class1, class2] = compareValues(item1.level, item2.level);
                    return (
                      <tr>
                        <td>Level</td>
                        <td className={class1}>{item1.level}</td>
                        <td className={class2}>{item2.level}</td>
                      </tr>
                    );
                  })()}
                  
                  {/* Value comparison with highlights */}
                  {(() => {
                    const [class1, class2] = compareValues(item1.vendor_value, item2.vendor_value);
                    return (
                      <tr>
                        <td>Value</td>
                        <td className={class1}>{formatCurrency(item1.vendor_value)}</td>
                        <td className={class2}>{formatCurrency(item2.vendor_value)}</td>
                      </tr>
                    );
                  })()}
                  
                  <tr>
                    <td>Source</td>
                    <td>{getItemSource(item1)}</td>
                    <td>{getItemSource(item2)}</td>
                  </tr>
                  
                  <tr className="spacer"><td colSpan={3}></td></tr>
                  
                  <tr className="section-header">
                    <td colSpan={3}>Item Details</td>
                  </tr>
                  
                  <tr>
                    <td>Description</td>
                    <td>{item1.description || 'No description'}</td>
                    <td>{item2.description || 'No description'}</td>
                  </tr>
                  
                  <tr>
                    <td>Properties</td>
                    <td>
                      <ul className="compare-flags-list">
                        {item1.flags.map(flag => (
                          <li key={flag} className="compare-flag">{flag}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <ul className="compare-flags-list">
                        {item2.flags.map(flag => (
                          <li key={flag} className="compare-flag">{flag}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>
              
              <div className="compare-actions">
                <Link href={`/items/${item1.id}`} className="item-details-button">
                  View Details for {item1.name}
                </Link>
                <Link href={`/items/${item2.id}`} className="item-details-button">
                  View Details for {item2.name}
                </Link>
                <Link href="/" className="compare-back-button">
                  Compare Different Items
                </Link>
              </div>
            </>
          ) : (
            <p className="no-items-message">
              One or both items couldn't be found. Please try selecting different items for comparison.
            </p>
          )}
        </div>
      )}
    </div>
  );
} 