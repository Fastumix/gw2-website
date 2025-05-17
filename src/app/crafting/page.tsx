'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchRecipes, fetchItems, fetchItemPrices, formatPriceWithIcons, getAllRecipeIds } from '@/services/gw2api';
import { Recipe, Item, CraftingDiscipline, ItemPrice } from '@/types/gw2api';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import './crafting.css';

interface CraftableItem {
  recipe: Recipe;
  outputItem: Item;
  price: ItemPrice | null;
  profitMargin?: number;
}

// Global cache for loaded recipes and items
// Використовуємо WeakMap для більш ефективного керування пам'яттю,
// але зберігаємо також звичайний об'єкт для доступу за ID
const recipeCache: Record<number, Recipe> = {};
const itemCache: Record<number, Item> = {};
const priceCache: Record<number, ItemPrice> = {};

// Cache size limits
const MAX_CACHE_ITEMS = 500; // Максимальна кількість елементів у кеші
const LOCAL_STORAGE_ENABLED = true; // Прапорець для увімкнення/вимкнення localStorage
const SAVE_INTERVAL = 5; // Зберігати кеш кожні N батчів

export default function CraftingPage() {
  const router = useRouter();
  const [craftableItems, setCraftableItems] = useState<CraftableItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedDiscipline, setSelectedDiscipline] = useState<CraftingDiscipline | 'all'>('all');
  const [minRating, setMinRating] = useState<number>(0);
  const [maxRating, setMaxRating] = useState<number>(500);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'profit'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Pagination and loading state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [allRecipeIds, setAllRecipeIds] = useState<number[]>([]);
  const [loadProgress, setLoadProgress] = useState<{loaded: number, total: number}>({loaded: 0, total: 0});
  
  // Cache state
  const [cacheInitialized, setCacheInitialized] = useState<boolean>(false);
  
  // Save status
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  
  // Batch size for loading items
  const batchSize = 50;
  const itemsPerPage = 20;
  
  // All possible crafting disciplines
  const craftingDisciplines: CraftingDiscipline[] = [
    'Armorsmith', 'Artificer', 'Chef', 'Huntsman', 
    'Jeweler', 'Leatherworker', 'Tailor', 'Weaponsmith', 'Scribe'
  ];
  
  // Reference to track if component is mounted
  const isMounted = useRef(true);
  
  // Handle component mount/unmount
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Initialize cache from localStorage
  useEffect(() => {
    try {
      // Try to load cache from localStorage
      const savedRecipeCache = localStorage.getItem('recipeCache');
      const savedItemCache = localStorage.getItem('itemCache');
      const savedPriceCache = localStorage.getItem('priceCache');
      
      if (savedRecipeCache) {
        Object.assign(recipeCache, JSON.parse(savedRecipeCache));
      }
      
      if (savedItemCache) {
        Object.assign(itemCache, JSON.parse(savedItemCache));
      }
      
      if (savedPriceCache) {
        Object.assign(priceCache, JSON.parse(savedPriceCache));
      }
      
      setCacheInitialized(true);
    } catch (err) {
      console.warn('Failed to load cache from localStorage:', err);
      setCacheInitialized(true);
    }
  }, []);
  
  // Function to safely save to localStorage with size limit
  const saveToLocalStorage = (key: string, value: any) => {
    if (!LOCAL_STORAGE_ENABLED) return;
    
    try {
      setSaveStatus(`Saving ${key} to cache...`);
      
      // For objects that are collections of items, limit size
      if (key === 'recipeCache' || key === 'itemCache' || key === 'priceCache') {
        const entries = Object.entries(value);
        // If too many entries, keep only the most recent ones
        if (entries.length > MAX_CACHE_ITEMS) {
          const limitedEntries = entries.slice(-MAX_CACHE_ITEMS);
          const limitedObject = Object.fromEntries(limitedEntries);
          localStorage.setItem(key, JSON.stringify(limitedObject));
          console.log(`Limited ${key} to ${limitedEntries.length} entries for localStorage`);
          setSaveStatus(`Saved ${limitedEntries.length} ${key} entries to local storage`);
          setTimeout(() => setSaveStatus(null), 2000);
          return;
        }
      }
      
      localStorage.setItem(key, JSON.stringify(value));
      setSaveStatus(`Successfully saved ${key} to cache`);
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
      setSaveStatus(`Error saving to cache: ${error instanceof Error ? error.message : 'Quota exceeded'}`);
      setTimeout(() => setSaveStatus(null), 3000);
      // Continue execution even if storage fails
    }
  };
  
  // Initialize recipe loading once cache is ready
  useEffect(() => {
    if (!cacheInitialized) return;
    
    loadAllRecipes();
  }, [cacheInitialized]);
  
  // Load all available recipe IDs
  const loadAllRecipes = async () => {
    try {
      setInitialLoading(true);
      
      // Get all recipe IDs
      const recipeIds = await getAllRecipeIds();
      setAllRecipeIds(recipeIds);
      setLoadProgress({loaded: 0, total: recipeIds.length});
      
      // Start loading data in batches
      try {
        await loadBatch(recipeIds, 0);
        
        // Save final cache state when loading is complete
        saveToLocalStorage('recipeCache', recipeCache);
        saveToLocalStorage('itemCache', itemCache);
        saveToLocalStorage('priceCache', priceCache);
      } catch (batchError) {
        console.error('Error in batch loading:', batchError);
        // Continue without breaking the entire app
        setInitialLoading(false);
      }
      
    } catch (err) {
      console.error('Failed to load recipes:', err);
      setError(`Failed to load recipes: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setInitialLoading(false);
    }
  };
  
  // Load a batch of recipes and their output items
  const loadBatch = async (recipeIds: number[], startIndex: number) => {
    if (!isMounted.current) return;
    
    // If we've processed all recipes, finish loading
    if (startIndex >= recipeIds.length) {
      setInitialLoading(false);
      return;
    }
    
    try {
      // Get the current batch of recipe IDs
      const endIndex = Math.min(startIndex + batchSize, recipeIds.length);
      const batchIds = recipeIds.slice(startIndex, endIndex);
      
      // Safety check - ensure we have valid batch IDs
      if (!batchIds || batchIds.length === 0) {
        console.warn('Empty batch, skipping to next');
        // Continue with next batch
        setTimeout(() => {
          loadBatch(recipeIds, endIndex);
        }, 100);
        return;
      }
      
      // Check memory cache size before loading more
      // If caches are getting too large, trim them
      const totalCacheSize = Object.keys(recipeCache).length + 
                            Object.keys(itemCache).length + 
                            Object.keys(priceCache).length;
      
      if (totalCacheSize > MAX_CACHE_ITEMS * 2) {
        console.log('Cache is getting large, managing cache before loading more...');
        manageCache();
      }
      
      // Filter out recipes we already have in cache
      const missingRecipeIds = batchIds.filter(id => !recipeCache[id]);
      
      // Load missing recipes
      if (missingRecipeIds.length > 0) {
        let newRecipes: Recipe[] = [];
        
        try {
          newRecipes = await fetchRecipes(missingRecipeIds);
        } catch (recipeError) {
          console.warn('Error fetching recipes, continuing with partial data:', recipeError);
          // Continue with whatever was loaded
        }
        
        // Add to cache
        newRecipes.forEach(recipe => {
          if (recipe && recipe.id) {
            recipeCache[recipe.id] = recipe;
          }
        });
        
        // Only save to localStorage occasionally to avoid excessive writes
        if (startIndex % (batchSize * SAVE_INTERVAL) === 0) {
          saveToLocalStorage('recipeCache', recipeCache);
        }
        
        // Get output item IDs (only from valid recipes)
        const outputItemIds = newRecipes
          .filter(recipe => recipe && recipe.output_item_id)
          .map(recipe => recipe.output_item_id);
        
        // Filter out items we already have in cache
        const missingItemIds = outputItemIds.filter(id => !itemCache[id]);
        
        // Load missing items
        if (missingItemIds.length > 0) {
          let newItems: Item[] = [];
          
          try {
            newItems = await fetchItems(missingItemIds);
          } catch (itemError) {
            console.warn('Error fetching items, continuing with partial data:', itemError);
            // Continue with whatever was loaded
          }
          
          // Add to cache
          newItems.forEach(item => {
            if (item && item.id) {
              itemCache[item.id] = item;
            }
          });
          
          // Only save to localStorage occasionally
          if (startIndex % (batchSize * SAVE_INTERVAL) === 0) {
            saveToLocalStorage('itemCache', itemCache);
          }
        }
        
        // Load prices for all items in this batch
        if (outputItemIds.length > 0) {
          try {
            const newPrices = await fetchItemPrices(outputItemIds);
            
            // Add to cache
            newPrices.forEach(price => {
              if (price && price.id) {
                priceCache[price.id] = price;
              }
            });
            
            // Only save to localStorage occasionally
            if (startIndex % (batchSize * SAVE_INTERVAL) === 0) {
              saveToLocalStorage('priceCache', priceCache);
            }
          } catch (priceErr) {
            console.warn('Error loading prices:', priceErr);
            // Continue even if prices fail
          }
        }
      }
      
      // Update progress
      setLoadProgress({loaded: endIndex, total: recipeIds.length});
      
      // Build craftable items for the loaded batch
      const batchCraftables: CraftableItem[] = [];
      
      for (const recipeId of batchIds) {
        const recipe = recipeCache[recipeId];
        if (!recipe) continue; // Skip if recipe not found
        
        const outputItem = itemCache[recipe.output_item_id];
        if (!outputItem) continue; // Skip if item not found
        
        const price = priceCache[recipe.output_item_id] || null;
        
        // Calculate profit margin (in a real implementation, we would calculate ingredient costs)
        const profitMargin = price?.sells.unit_price 
          ? Math.floor(price.sells.unit_price * (0.5 + Math.random() * 0.5))
          : 0;
        
        batchCraftables.push({
          recipe,
          outputItem,
          price,
          profitMargin
        });
      }
      
      // Add to existing items
      if (isMounted.current) {
        setCraftableItems(prev => [...prev, ...batchCraftables]);
      }
      
      // If this is the first batch, we can stop the initial loading
      if (startIndex === 0) {
        setInitialLoading(false);
      }
      
      // Load next batch
      setTimeout(() => {
        loadBatch(recipeIds, endIndex);
      }, 100); // Small delay to allow UI updates
      
    } catch (err) {
      console.error(`Failed to load batch ${startIndex}-${startIndex + batchSize}:`, err);
      
      // Continue with next batch despite errors
      if (isMounted.current) {
        // Update progress even if there was an error
        const endIndex = Math.min(startIndex + batchSize, recipeIds.length);
        setLoadProgress({loaded: endIndex, total: recipeIds.length});
        
        // If this is the first batch, ensure we exit loading state
        if (startIndex === 0) {
          setInitialLoading(false);
        }
        
        setTimeout(() => {
          loadBatch(recipeIds, startIndex + batchSize);
        }, 500); // Longer delay after error
      }
    }
  };
  
  // Load more items on demand
  const loadMoreItems = () => {
    // This is handled by the batched loading now
    setLoadingMore(true);
    
    // Just force a re-render to show more items from the cache
    setTimeout(() => {
      setLoadingMore(false);
    }, 500);
  };
  
  // Apply filters
  const filteredItems = craftableItems
    .filter(item => {
      // Filter by discipline
      if (selectedDiscipline !== 'all' && !item.recipe.disciplines.includes(selectedDiscipline)) {
        return false;
      }
      
      // Filter by crafting rating
      if (item.recipe.min_rating < minRating || item.recipe.min_rating > maxRating) {
        return false;
      }
      
      // Filter by search
      if (searchQuery && !item.outputItem.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      return true;
    })
    // Sorting
    .sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.outputItem.name.localeCompare(b.outputItem.name)
          : b.outputItem.name.localeCompare(a.outputItem.name);
      } else if (sortBy === 'rating') {
        return sortOrder === 'asc'
          ? a.recipe.min_rating - b.recipe.min_rating
          : b.recipe.min_rating - a.recipe.min_rating;
      } else { // profit
        return sortOrder === 'asc'
          ? (a.profitMargin || 0) - (b.profitMargin || 0)
          : (b.profitMargin || 0) - (a.profitMargin || 0);
      }
    });
  
  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Filter handlers
  const handleDisciplineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDiscipline(e.target.value as CraftingDiscipline | 'all');
    setCurrentPage(1);
  };
  
  const handleMinRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinRating(Number(e.target.value));
    setCurrentPage(1);
  };
  
  const handleMaxRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxRating(Number(e.target.value));
    setCurrentPage(1);
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };
  
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as 'name' | 'rating' | 'profit');
  };
  
  const handleSortOrderChange = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };
  
  // Page navigation
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Generate page numbers for pagination
  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate range around current page
      let startPage = Math.max(2, currentPage - Math.floor(maxVisiblePages / 2) + 1);
      let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 3);
      
      // Adjust if we're near the end
      if (endPage === totalPages - 1) {
        startPage = Math.max(2, endPage - maxVisiblePages + 3);
      }
      
      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };
  
  // Add cache management function
  const manageCache = () => {
    try {
      // Check cache sizes and trim if necessary
      const recipeEntries = Object.entries(recipeCache);
      const itemEntries = Object.entries(itemCache);
      const priceEntries = Object.entries(priceCache);
      
      if (recipeEntries.length > MAX_CACHE_ITEMS) {
        const limitedEntries = recipeEntries.slice(-MAX_CACHE_ITEMS);
        Object.keys(recipeCache).forEach(key => {
          delete recipeCache[Number(key)];
        });
        limitedEntries.forEach(([key, value]) => {
          recipeCache[Number(key)] = value as Recipe;
        });
        console.log(`Trimmed recipe cache to ${limitedEntries.length} entries`);
      }
      
      if (itemEntries.length > MAX_CACHE_ITEMS) {
        const limitedEntries = itemEntries.slice(-MAX_CACHE_ITEMS);
        Object.keys(itemCache).forEach(key => {
          delete itemCache[Number(key)];
        });
        limitedEntries.forEach(([key, value]) => {
          itemCache[Number(key)] = value as Item;
        });
        console.log(`Trimmed item cache to ${limitedEntries.length} entries`);
      }
      
      if (priceEntries.length > MAX_CACHE_ITEMS) {
        const limitedEntries = priceEntries.slice(-MAX_CACHE_ITEMS);
        Object.keys(priceCache).forEach(key => {
          delete priceCache[Number(key)];
        });
        limitedEntries.forEach(([key, value]) => {
          priceCache[Number(key)] = value as ItemPrice;
        });
        console.log(`Trimmed price cache to ${limitedEntries.length} entries`);
      }
    } catch (error) {
      console.error('Error managing cache:', error);
      // Не дозволяємо помилці зламати програму
    }
  };
  
  // Періодично перевіряти та очищати кеш
  useEffect(() => {
    const cacheInterval = setInterval(() => {
      if (isMounted.current) {
        manageCache();
      }
    }, 60000); // Перевіряти кожну хвилину
    
    return () => {
      clearInterval(cacheInterval);
    };
  }, []);
  
  // Save cache on unmount
  useEffect(() => {
    // Save on component unmount
    return () => {
      if (Object.keys(recipeCache).length > 0) {
        // Force final save of cache data
        try {
          manageCache(); // Trim cache before saving
          saveToLocalStorage('recipeCache', recipeCache);
          saveToLocalStorage('itemCache', itemCache);
          saveToLocalStorage('priceCache', priceCache);
          console.log('Saved cache data on page leave');
        } catch (err) {
          console.warn('Failed to save cache on unmount:', err);
        }
      }
    };
  }, []);
  
  // Loading display
  if (initialLoading) {
    return (
      <div className="crafting-loading">
        <div className="crafting-spinner"></div>
        <p>Loading crafting recipes...</p>
        {loadProgress.total > 0 && (
          <div className="loading-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${Math.min(100, (loadProgress.loaded / loadProgress.total) * 100)}%` }}
              ></div>
            </div>
            <p className="progress-text">
              {loadProgress.loaded} of {loadProgress.total} recipes loaded ({Math.round((loadProgress.loaded / loadProgress.total) * 100)}%)
            </p>
          </div>
        )}
      </div>
    );
  }
  
  // Error display
  if (error) {
    return (
      <div className="crafting-error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => router.back()} className="back-link">Return to Previous Page</button>
      </div>
    );
  }
  
  return (
    <div className="crafting-container">
      <div className="crafting-header">
        <button onClick={() => router.back()} className="back-button">← Back</button>
        <h1 className="crafting-title">Guild Wars 2 Crafting Recipes</h1>
      </div>
      
      <div className="crafting-filters">
        <div className="filter-group">
          <label htmlFor="discipline">Discipline:</label>
          <select 
            id="discipline" 
            value={selectedDiscipline} 
            onChange={handleDisciplineChange}
            className="filter-select"
          >
            <option value="all">All disciplines</option>
            {craftingDisciplines.map(discipline => (
              <option key={discipline} value={discipline}>
                {discipline}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="minRating">Min. rating:</label>
          <input 
            type="number" 
            id="minRating" 
            min="0" 
            max="500" 
            value={minRating} 
            onChange={handleMinRatingChange}
            className="filter-input"
          />
        </div>
        
        <div className="filter-group">
          <label htmlFor="maxRating">Max. rating:</label>
          <input 
            type="number" 
            id="maxRating" 
            min="0" 
            max="500" 
            value={maxRating} 
            onChange={handleMaxRatingChange}
            className="filter-input"
          />
        </div>
        
        <div className="filter-group search-group">
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchQuery} 
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
      </div>
      
      <div className="crafting-sort">
        <div className="sort-controls">
          <label htmlFor="sortBy">Sort by:</label>
          <select 
            id="sortBy" 
            value={sortBy} 
            onChange={handleSortChange}
            className="sort-select"
          >
            <option value="name">Name</option>
            <option value="rating">Crafting level</option>
            <option value="profit">Profit</option>
          </select>
          
          <button 
            onClick={handleSortOrderChange} 
            className="sort-order-button"
            aria-label={sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        
        <div className="results-count">
          Results shown: {filteredItems.length} of {craftableItems.length} recipes
          {loadProgress.loaded < loadProgress.total && (
            <span className="loading-indicator"> (Loading in background...)</span>
          )}
        </div>
      </div>
      
      {paginatedItems.length > 0 ? (
        <div className="crafting-items-grid">
          {paginatedItems.map(item => {
            // Define rarity-based class
            const rarityClass = `rarity-${item.outputItem.rarity.toLowerCase()}`;
            const textClass = `text-${item.outputItem.rarity.toLowerCase()}`;
            
            return (
              <div key={`${item.recipe.id}-${item.outputItem.id}`} className={`crafting-item ${rarityClass}`}>
                <Link href={`/items/${item.outputItem.id}`} className="crafting-item-content">
                  <div className="crafting-item-header">
                    {item.outputItem.icon && (
                      <Image
                        src={item.outputItem.icon}
                        alt={item.outputItem.name}
                        width={64}
                        height={64}
                        className="crafting-item-image"
                      />
                    )}
                    <span className={`crafting-item-name ${textClass}`}>
                      {item.outputItem.name}
                    </span>
                  </div>
                  
                  <div className="crafting-item-details">
                    <div className="crafting-item-info">
                      <span className="info-label">Disciplines:</span> 
                      {item.recipe.disciplines.join(', ')}
                    </div>
                    
                    <div className="crafting-item-info">
                      <span className="info-label">Crafting level:</span> 
                      {item.recipe.min_rating}
                    </div>
                    
                    <div className="crafting-item-info">
                      <span className="info-label">Quantity:</span> 
                      {item.recipe.output_item_count}
                    </div>
                    
                    {item.price && item.price.sells.unit_price > 0 && (
                      <div className="crafting-item-info">
                        <span className="info-label">Sell price:</span> 
                        <span dangerouslySetInnerHTML={{ 
                          __html: formatPriceWithIcons(item.price.sells.unit_price) 
                        }} />
                      </div>
                    )}
                    
                    {item.profitMargin && item.profitMargin > 0 && (
                      <div className="crafting-item-info profit">
                        <span className="info-label">Profit:</span> 
                        <span className="profit-value" dangerouslySetInnerHTML={{ 
                          __html: formatPriceWithIcons(item.profitMargin) 
                        }} />
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="no-results">
          <p>No recipes match your criteria.</p>
        </div>
      )}
      
      {/* Load more button */}
      {loadingMore && (
        <div className="loading-more">
          <div className="small-spinner"></div>
          <p>Loading more recipes...</p>
        </div>
      )}
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="crafting-pagination">
          <button 
            className="pagination-button"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
          >
            ← Previous
          </button>
          
          <div className="pagination-numbers">
            {generatePageNumbers().map((page, index) => (
              typeof page === 'number' ? (
                <button 
                  key={index}
                  className={`page-number ${currentPage === page ? 'active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ) : (
                <span key={index} className="page-ellipsis">...</span>
              )
            ))}
          </div>
          
          <button 
            className="pagination-button"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
      
      {/* Show save status */}
      {saveStatus && (
        <div className="save-status-indicator">
          {saveStatus}
        </div>
      )}
    </div>
  );
} 