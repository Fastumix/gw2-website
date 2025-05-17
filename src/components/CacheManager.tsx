import React, { useState, useEffect } from 'react';
import { getCacheStats, clearCache } from '@/services/cachingService';
import { fetchItems, fetchAllItemIds, getAllRecipeIds, fetchRecipes } from '@/services/gw2api';
import './CacheManager.css';

interface CacheManagerProps {
  onClose: () => void;
}

interface CacheStats {
  items: number;
  recipes: number;
  prices: number;
  lastUpdated: {
    items: string | null;
    recipes: string | null;
    prices: string | null;
  }
}

const CacheManager: React.FC<CacheManagerProps> = ({ onClose }) => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);
  const [loadingRecipes, setLoadingRecipes] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<{current: number, total: number, type: string}>({
    current: 0,
    total: 0,
    type: ''
  });
  const [message, setMessage] = useState<string>('');
  
  useEffect(() => {
    loadStats();
  }, []);
  
  const loadStats = async () => {
    setLoading(true);
    try {
      const cacheStats = await getCacheStats();
      setStats(cacheStats);
    } catch (error) {
      console.error('Error loading cache stats:', error);
      setMessage('Failed to load cache statistics');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClearCache = async (type?: string) => {
    if (!confirm(`Are you sure you want to clear the ${type || 'entire'} cache?`)) {
      return;
    }
    
    setLoading(true);
    setMessage(`Clearing ${type || 'all'} cache...`);
    
    try {
      await clearCache(type);
      setMessage(`Successfully cleared ${type || 'all'} cache`);
      loadStats();
    } catch (error) {
      console.error('Error clearing cache:', error);
      setMessage(`Failed to clear ${type || 'all'} cache`);
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const handleLoadAllItems = async () => {
    setLoadingItems(true);
    setMessage('Loading all items...');
    setLoadingProgress({current: 0, total: 1, type: 'items'});
    
    try {
      // First get all item IDs
      const allItemIds = await fetchAllItemIds();
      setLoadingProgress({current: 0, total: allItemIds.length, type: 'items'});
      
      // Load items in batches
      const batchSize = 200; // API limit
      let loaded = 0;
      
      for (let i = 0; i < allItemIds.length; i += batchSize) {
        if (!loadingItems) break; // Stop if canceled
        
        const batchIds = allItemIds.slice(i, i + batchSize);
        await fetchItems(batchIds);
        
        loaded += batchIds.length;
        setLoadingProgress({current: loaded, total: allItemIds.length, type: 'items'});
        setMessage(`Loaded ${loaded} of ${allItemIds.length} items (${Math.round(loaded / allItemIds.length * 100)}%)`);
        
        // Short pause to avoid overloading the API and to update UI
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      setMessage('Successfully loaded all items');
      loadStats();
    } catch (error) {
      console.error('Error loading items:', error);
      setMessage('Failed to load all items');
    } finally {
      setLoadingItems(false);
    }
  };
  
  const handleCancelLoadItems = () => {
    setLoadingItems(false);
    setMessage('Item loading canceled');
  };
  
  const handleLoadAllRecipes = async () => {
    setLoadingRecipes(true);
    setMessage('Loading all recipes...');
    setLoadingProgress({current: 0, total: 1, type: 'recipes'});
    
    try {
      // First get all recipe IDs
      const allRecipeIds = await getAllRecipeIds();
      setLoadingProgress({current: 0, total: allRecipeIds.length, type: 'recipes'});
      
      // Load recipes in batches
      const batchSize = 200; // API limit
      let loaded = 0;
      
      for (let i = 0; i < allRecipeIds.length; i += batchSize) {
        if (!loadingRecipes) break; // Stop if canceled
        
        const batchIds = allRecipeIds.slice(i, i + batchSize);
        await fetchRecipes(batchIds);
        
        loaded += batchIds.length;
        setLoadingProgress({current: loaded, total: allRecipeIds.length, type: 'recipes'});
        setMessage(`Loaded ${loaded} of ${allRecipeIds.length} recipes (${Math.round(loaded / allRecipeIds.length * 100)}%)`);
        
        // Short pause to avoid overloading the API and to update UI
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      setMessage('Successfully loaded all recipes');
      loadStats();
    } catch (error) {
      console.error('Error loading recipes:', error);
      setMessage('Failed to load all recipes');
    } finally {
      setLoadingRecipes(false);
    }
  };
  
  const handleCancelLoadRecipes = () => {
    setLoadingRecipes(false);
    setMessage('Recipe loading canceled');
  };
  
  return (
    <div className="cache-manager-overlay">
      <div className="cache-manager-container">
        <button className="cache-manager-close" onClick={onClose}>×</button>
        
        <h2>Data Cache Manager</h2>
        
        {message && (
          <div className="cache-manager-message">
            {message}
          </div>
        )}
        
        {loadingItems || loadingRecipes ? (
          <div className="cache-manager-loading">
            <div className="cache-manager-progress">
              <div 
                className="cache-manager-progress-bar"
                style={{ width: `${Math.min(100, (loadingProgress.current / loadingProgress.total) * 100)}%` }}
              ></div>
            </div>
            <div className="cache-manager-progress-text">
              Loading {loadingProgress.type}: {loadingProgress.current} of {loadingProgress.total} 
              ({Math.round((loadingProgress.current / loadingProgress.total) * 100)}%)
            </div>
            
            <button 
              className="cache-manager-cancel-button"
              onClick={loadingItems ? handleCancelLoadItems : handleCancelLoadRecipes}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="cache-manager-stats">
              {loading ? (
                <div className="cache-manager-loading-stats">Loading cache statistics...</div>
              ) : stats ? (
                <table className="cache-manager-stats-table">
                  <thead>
                    <tr>
                      <th>Data Type</th>
                      <th>Cached Items</th>
                      <th>Last Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Items</td>
                      <td>{stats.items}</td>
                      <td>{formatDate(stats.lastUpdated.items)}</td>
                      <td>
                        <button onClick={() => handleClearCache('items')} disabled={loading}>
                          Clear
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td>Recipes</td>
                      <td>{stats.recipes}</td>
                      <td>{formatDate(stats.lastUpdated.recipes)}</td>
                      <td>
                        <button onClick={() => handleClearCache('recipes')} disabled={loading}>
                          Clear
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td>Prices</td>
                      <td>{stats.prices}</td>
                      <td>{formatDate(stats.lastUpdated.prices)}</td>
                      <td>
                        <button onClick={() => handleClearCache('prices')} disabled={loading}>
                          Clear
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="cache-manager-no-stats">No cache statistics available</div>
              )}
            </div>
            
            <div className="cache-manager-actions">
              <div className="cache-manager-action-group">
                <h3>Load Data</h3>
                <p>Load all data at once to avoid repeated loading during browsing.</p>
                <div className="cache-manager-buttons">
                  <button 
                    onClick={handleLoadAllItems} 
                    disabled={loading || loadingItems}
                    className="cache-manager-load-button"
                  >
                    Load All Items
                  </button>
                  <button 
                    onClick={handleLoadAllRecipes} 
                    disabled={loading || loadingRecipes}
                    className="cache-manager-load-button"
                  >
                    Load All Recipes
                  </button>
                </div>
              </div>
              
              <div className="cache-manager-action-group">
                <h3>Clear Cache</h3>
                <p>Clear the cache to free up space or if you're experiencing issues.</p>
                <button 
                  onClick={() => handleClearCache()} 
                  disabled={loading}
                  className="cache-manager-clear-button"
                >
                  Clear All Cache
                </button>
              </div>
            </div>
          </>
        )}
        
        <div className="cache-manager-info">
          <p>The cached data is stored in your browser and will be available even after you close the browser.</p>
          <p>The items and recipes data rarely change, so you can load them once and use them for a long time.</p>
          <p>Price data may be updated more frequently (hourly) to ensure accuracy.</p>
        </div>
      </div>
    </div>
  );
};

export default CacheManager; 