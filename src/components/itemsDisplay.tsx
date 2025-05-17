// src/components/itemsDisplay.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Item, Recipe, ItemRarity, ItemPrice } from '@/types/gw2api';
import { 
  searchRecipesByOutput, 
  fetchRecipe, 
  fetchItems, 
  fetchItemsByCategory,
  fetchItemPrice,
  fetchItemPrices,
  formatPriceWithIcons,
  FilterParams
} from '@/services/gw2api';
import { getFavorites, addToFavorites, removeFromFavorites, isFavorite } from '@/services/favoriteService';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import './itemsDisplay.css';

export default function ItemsGrid() {
  // URL параметри
  const searchParams = useSearchParams();
  const compareItemId = searchParams.get('compare');
  const isCompareMode = !!compareItemId;

  // Items state
  const [displayedItems, setDisplayedItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 25;
  
  // Category
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Sorting
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRarities, setSelectedRarities] = useState<ItemRarity[]>([]);
  const [minLevel, setMinLevel] = useState(0);
  const [maxLevel, setMaxLevel] = useState(80);
  const [showFilters, setShowFilters] = useState(false);
  
  // Активні фільтри
  const [activeFilters, setActiveFilters] = useState<FilterParams>({});
  
  // Debounce timeouts
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const levelTimeout = useRef<NodeJS.Timeout | null>(null);

  // Додаємо стан для улюблених предметів
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  const categories = [
    { id: 'all', name: 'All' },
    { id: 'favorites', name: 'Favorites' },
    { id: 'CraftingMaterial', name: 'Crafting Materials' },
    { id: 'Weapon', name: 'Weapons' },
    { id: 'Armor', name: 'Armor' },
    { id: 'Consumable', name: 'Consumables' },
  ];
  
  const rarities = [
    'Junk',
    'Basic',
    'Fine',
    'Masterwork',
    'Rare',
    'Exotic',
    'Ascended',
    'Legendary'
  ] as ItemRarity[];
  
  // Rarity order for sorting (from lowest to highest)
  const rarityOrder = {
    'Junk': 0,
    'Basic': 1,
    'Fine': 2,
    'Masterwork': 3,
    'Rare': 4,
    'Exotic': 5,
    'Ascended': 6,
    'Legendary': 7
  };

  useEffect(() => {
    loadItems('all', 0);
    // Завантажуємо улюблені предмети при запуску
    setFavoriteIds(getFavorites());
  }, []);
  
  // Відстежуємо зміни фільтрів і оновлюємо activeFilters
  useEffect(() => {
    const newFilters: FilterParams = {};
    
    if (searchQuery.trim()) {
      newFilters.search = searchQuery.trim();
    }
    
    if (selectedRarities.length > 0) {
      newFilters.rarities = [...selectedRarities];
    }
    
    if (minLevel > 0) {
      newFilters.minLevel = minLevel;
    }
    
    if (maxLevel < 80) {
      newFilters.maxLevel = maxLevel;
    }
    
    // Перевіряємо, чи зміна фільтрів потребує перезавантаження даних
    const filtersChanged = !isEqual(activeFilters, newFilters);
    setActiveFilters(newFilters);
    
    if (filtersChanged) {
      loadItems(selectedCategory, 0, newFilters);
    }
  }, [searchQuery, selectedRarities, minLevel, maxLevel]);

  // Load items based on category and page
  const loadItems = async (category: string, page: number, filters: FilterParams = activeFilters) => {
    try {
      if (page === 0) {
        // Якщо завантажуємо першу сторінку, показуємо повний індикатор завантаження
        setInitialLoading(true);
      } else {
        // Інакше показуємо індикатор "loading more"
        setLoadingMore(true);
      }
      
      setLoading(true);
      
      if (category !== selectedCategory) {
        setSelectedCategory(category);
      }
      
      // Спеціальна обробка для категорії "favorites"
      if (category === 'favorites') {
        const favorites = getFavorites();
        if (favorites.length === 0) {
          setDisplayedItems([]);
          setTotalItems(0);
          setHasMore(false);
          setCurrentPage(0);
          setLoading(false);
          setInitialLoading(false);
          setLoadingMore(false);
          return;
        }
        
        // Обчислюємо діапазон ID для поточної сторінки
        const startIndex = page * itemsPerPage;
        const endIndex = Math.min(favorites.length, startIndex + itemsPerPage);
        const pageIds = favorites.slice(startIndex, endIndex);
        
        // Завантажуємо улюблені предмети
        let favoriteItems = await fetchItems(pageIds);
        
        // Застосовуємо фільтри, якщо вони є
        if (Object.keys(filters).length > 0) {
          favoriteItems = filterItems(favoriteItems, filters);
        }
        
        // Apply sorting if there's a sort order set
        if (sortOrder) {
          favoriteItems = sortItemsByRarity(favoriteItems, sortOrder);
        }
        
        if (page === 0) {
          setDisplayedItems(favoriteItems);
        } else {
          setDisplayedItems(prev => {
            const existingIds = new Set(prev.map(item => item.id));
            const uniqueNewItems = favoriteItems.filter(item => !existingIds.has(item.id));
            return [...prev, ...uniqueNewItems];
          });
        }
        
        setTotalItems(favorites.length);
        setHasMore(endIndex < favorites.length);
        setCurrentPage(page);
      } else {
        // Використовуємо оновлений API з пагінацією та фільтрами
        const result = await fetchItemsByCategory(category, page, itemsPerPage, filters);
      
        let itemsToDisplay = result.items;
        
        // Apply sorting if there's a sort order set
        if (sortOrder) {
          itemsToDisplay = sortItemsByRarity(itemsToDisplay, sortOrder);
        }
        
        if (page === 0) {
          // Якщо це перша сторінка, замінюємо весь список
          setDisplayedItems(itemsToDisplay);
        } else {
          // Інакше додаємо до існуючого списку з унікальними ID
          setDisplayedItems(prev => {
            // Створюємо мапу існуючих ID
            const existingIds = new Set(prev.map(item => item.id));
            // Фільтруємо нові елементи, щоб уникнути дублікатів
            const uniqueNewItems = itemsToDisplay.filter(item => !existingIds.has(item.id));
            return [...prev, ...uniqueNewItems];
          });
        }
        
        setTotalItems(result.totalCount);
        setHasMore(result.hasMore);
        setCurrentPage(page);
      }
    } catch (err) {
      setError(`Failed to load items: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setInitialLoading(false);
      setLoadingMore(false);
    }
  };

  // Перевірка чи два об'єкти фільтрів рівні
  const isEqual = (obj1: FilterParams, obj2: FilterParams): boolean => {
    // Порівнюємо кількість ключів
    if (Object.keys(obj1).length !== Object.keys(obj2).length) {
      return false;
    }
    
    // Порівнюємо примітивні значення
    for (const key in obj1) {
      if (key === 'rarities') continue; // Масиви перевіряємо окремо
      if (obj1[key as keyof FilterParams] !== obj2[key as keyof FilterParams]) {
        return false;
      }
    }
    
    // Порівнюємо масиви rarities, якщо вони є
    if (obj1.rarities && obj2.rarities) {
      if (obj1.rarities.length !== obj2.rarities.length) {
        return false;
      }
      
      for (let i = 0; i < obj1.rarities.length; i++) {
        if (!obj2.rarities.includes(obj1.rarities[i])) {
          return false;
        }
      }
    } else if ((obj1.rarities && !obj2.rarities) || (!obj1.rarities && obj2.rarities)) {
      return false;
    }
    
    return true;
  };
  
  // Sort items by rarity
  const sortItemsByRarity = (items: Item[], order: 'asc' | 'desc'): Item[] => {
    return [...items].sort((a, b) => {
      const rarityA = rarityOrder[a.rarity as keyof typeof rarityOrder] || 0;
      const rarityB = rarityOrder[b.rarity as keyof typeof rarityOrder] || 0;
      
      return order === 'asc' ? rarityA - rarityB : rarityB - rarityA;
    });
  };
  
  // Handle sort change
  const handleSortChange = (newOrder: 'asc' | 'desc') => {
    // Toggle if it's the same order, otherwise use the new order
    const nextOrder = sortOrder === newOrder ? null : newOrder;
    setSortOrder(nextOrder);
    
    // Apply sorting to currently displayed items
    if (nextOrder) {
      setDisplayedItems(sortItemsByRarity([...displayedItems], nextOrder));
    } else {
      // If sorting is turned off, reload the current page to get the default order
      loadItems(selectedCategory, currentPage);
    }
  };
  
  // Search handler with debounce
  const handleSearch = (value: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      setSearchQuery(value);
    }, 300);
  };
  
  // Toggle rarity filter
  const toggleRarity = (rarity: ItemRarity) => {
    setSelectedRarities(prev => {
      if (prev.includes(rarity)) {
        return prev.filter(r => r !== rarity);
      } else {
        return [...prev, rarity];
      }
    });
  };
  
  // Handle level change with debounce
  const handleLevelChange = (min: number, max: number) => {
    if (levelTimeout.current) {
      clearTimeout(levelTimeout.current);
    }
    
    levelTimeout.current = setTimeout(() => {
      setMinLevel(min);
      setMaxLevel(max);
    }, 300);
  };
  
  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedRarities([]);
    setMinLevel(0);
    setMaxLevel(80);
    
    // Очищуємо активні фільтри
    setActiveFilters({});
    
    // Перезавантажуємо предмети без фільтрів
    loadItems(selectedCategory, 0, {});
    
    // Clear input elements
    const searchInput = document.getElementById('item-search') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
    
    const minLevelInput = document.getElementById('min-level') as HTMLInputElement;
    if (minLevelInput) minLevelInput.value = '0';
    
    const maxLevelInput = document.getElementById('max-level') as HTMLInputElement;
    if (maxLevelInput) maxLevelInput.value = '80';
  };
  
  // Load more items
  const loadMoreItems = () => {
    if (loadingMore || !hasMore) return;
    
    // Завантажуємо наступну сторінку для поточної категорії з активними фільтрами
    loadItems(selectedCategory, currentPage + 1);
  };
  
  // Handle category change
  const handleCategoryChange = (category: string) => {
    if (category === selectedCategory) return;
    
    // При зміні категорії завжди починаємо з першої сторінки
    loadItems(category, 0);
    
    // Прокручуємо вгору
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Handle page change in pagination
  const handlePageChange = (page: number) => {
    if (page === currentPage) return;
    
    loadItems(selectedCategory, page);
    
    // Прокручуємо вгору
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (initialLoading) return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p className="loading-text">Loading items...</p>
    </div>
  );
  
  if (error) return (
    <div className="error-container">
      <div className="error-box">
        <h2 className="error-title">Error</h2>
        <p className="error-message">{error}</p>
      </div>
    </div>
  );

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  
  // Generate pagination numbers
  const generatePaginationNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if there are fewer than maxVisiblePages
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(0);
      
      // Calculate start and end of visible pages
      let start = Math.max(1, currentPage - 1);
      let end = Math.min(totalPages - 2, start + maxVisiblePages - 3);
      
      // Adjust start if end is too close to totalPages
      if (end === totalPages - 2) {
        start = Math.max(1, end - (maxVisiblePages - 3));
      }
      
      // Add ellipsis if needed
      if (start > 1) {
        pages.push('ellipsis1');
      }
      
      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Add ellipsis if needed
      if (end < totalPages - 2) {
        pages.push('ellipsis2');
      }
      
      // Always show last page
      pages.push(totalPages - 1);
    }
    
    return pages;
  };
  
  const paginationItems = generatePaginationNumbers();
  
  // Перевіряємо, чи є активні фільтри
  const hasActiveFilters = Object.keys(activeFilters).length > 0;
  
  // Показуємо порожній стан, коли немає елементів
  const noItemsToShow = displayedItems.length === 0 && !loading;
  
  // Індикатор, скільки активних фільтрів
  const activeFiltersCount = Object.keys(activeFilters).length;

  return (
    <div className="main-content">
      {/* Page Title */}
      <div className="page-title">
        {isCompareMode ? (
          <div className="compare-mode-info">
            <p>Comparison mode: select a second item to compare with the first one</p>
            <Link 
              href="/compare"
              className="cancel-compare-button"
            >
              Cancel comparison
            </Link>
          </div>
        ) : (
          <p className="page-description">
            Browse through items from Guild Wars 2. 
            Filter by category and click on items to see their details.
          </p>
        )}
      </div>
      
      {/* Category filter tabs */}
      <div className="category-container">
        <div className="category-tabs">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => handleCategoryChange(category.id)}
              className={`category-button ${
                selectedCategory === category.id
                  ? 'category-button-active'
                  : 'category-button-inactive'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Search and filters */}
      <div className="search-container">
        <div className="search-box">
          <input
            type="text"
            id="item-search"
            placeholder="Search items by name or description..."
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
          <button 
            className="filter-toggle-button"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
            {activeFiltersCount > 0 && !showFilters && (
              <span className="filter-badge">{activeFiltersCount}</span>
            )}
          </button>
        </div>
        
        {showFilters && (
          <div className="advanced-filters">
            <div className="filter-section">
              <h3 className="filter-title">Rarity</h3>
              <div className="rarity-filters">
                {rarities.map(rarity => (
                  <label key={rarity} className={`rarity-checkbox text-${rarity.toLowerCase()}`}>
                    <input
                      type="checkbox"
                      checked={selectedRarities.includes(rarity)}
                      onChange={() => toggleRarity(rarity)}
                      className="rarity-input"
                    />
                    <span>{rarity}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="filter-row">
              <div className="filter-section">
                <h3 className="filter-title">Level</h3>
                <div className="range-filter">
                  <div className="range-inputs">
                    <input
                      type="number"
                      id="min-level"
                      min="0"
                      max="80"
                      defaultValue={minLevel.toString()}
                      onChange={(e) => handleLevelChange(Number(e.target.value), maxLevel)}
                      className="range-input"
                    />
                    <span>to</span>
                    <input
                      type="number"
                      id="max-level"
                      min="0"
                      max="80"
                      defaultValue={maxLevel.toString()}
                      onChange={(e) => handleLevelChange(minLevel, Number(e.target.value))}
                      className="range-input"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="filter-actions">
              <button 
                className="reset-filters-button"
                onClick={resetFilters}
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Items stats */}
      <div className="items-stats">
        <p>
          Showing {displayedItems.length} 
          {hasActiveFilters 
            ? ` filtered items (of ${totalItems})` 
            : ` of ${totalItems} items`}
        </p>
        {hasActiveFilters && (
          <div className="active-filters">
            <span>Active filters:</span>
            {activeFilters.search && (
              <span className="filter-tag">
                Search: "{activeFilters.search}"
              </span>
            )}
            {activeFilters.rarities && activeFilters.rarities.length > 0 && (
              <span className="filter-tag">
                Rarities: {activeFilters.rarities.join(', ')}
              </span>
            )}
            {(activeFilters.minLevel !== undefined || activeFilters.maxLevel !== undefined) && (
              <span className="filter-tag">
                Level: {activeFilters.minLevel || 0} - {activeFilters.maxLevel || 80}
              </span>
            )}
          </div>
        )}
      </div>

      {/* No items state */}
      {noItemsToShow && (
        <div className="empty-container">
          <div className="empty-box">
            <h2 className="empty-title">No Items Found</h2>
            <p className="empty-message">
              {hasActiveFilters 
                ? 'No items match your filter criteria. Try adjusting your filters.' 
                : 'There are no items to display for this category.'}
            </p>
          </div>
        </div>
      )}

      {/* Items grid */}
      {!noItemsToShow && (
        <div className="items-grid">
          {displayedItems.map((item, index) => (
            <ItemCard 
              key={`${item.id}-${index}`} // Унікальний ключ для запобігання помилки дублікатів
              item={item} 
            />
          ))}
        </div>
      )}
      
      {/* Loading indicator when loading more items */}
      {loadingMore && (
        <div className="loading-more">
          <div className="small-spinner"></div>
          <p>Loading more items...</p>
        </div>
      )}
      
      {/* Pagination and Load More */}
      {!noItemsToShow && (
        <div className="pagination-container">
          {hasMore && (
            <button 
              className="load-more-button"
              onClick={loadMoreItems}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <span className="small-spinner"></span>
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </button>
          )}
          
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                className="pagination-arrow" 
                onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                &laquo;
              </button>
              
              {paginationItems.map((page, index) => {
                if (page === 'ellipsis1' || page === 'ellipsis2') {
                  return <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>;
                }
                
                return (
                  <button
                    key={`page-${page}`}
                    className={`pagination-number ${currentPage === page ? 'pagination-active' : ''}`}
                    onClick={() => handlePageChange(Number(page))}
                  >
                    {Number(page) + 1} {/* Показуємо сторінки з 1, хоча внутрішньо починаємо з 0 */}
                  </button>
                );
              })}
              
              <button 
                className="pagination-arrow" 
                onClick={() => handlePageChange(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage === totalPages - 1}
              >
                &raquo;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ItemCardProps {
  item: Item;
}

function ItemCard({ item }: ItemCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [recipeInfo, setRecipeInfo] = useState<{recipe?: Recipe, ingredients?: Item[]}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasRecipe, setHasRecipe] = useState<boolean | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [itemPrice, setItemPrice] = useState<ItemPrice | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [ingredientPrices, setIngredientPrices] = useState<Record<number, ItemPrice>>({});
  const searchParams = useSearchParams();
  const compareItemId = searchParams.get('compare');
  const isCompareMode = !!compareItemId;

  // При монтуванні компонента, перевіряємо чи предмет в улюблених
  useEffect(() => {
    setIsFav(isFavorite(item.id));
  }, [item.id]);

  const handleMouseEnter = async () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const handleCardClick = async () => {
    setShowTooltip(true);
    if (hasRecipe === null && !isLoading) {
      setIsLoading(true);
      try {
        // Check if this item has a recipe
        const recipeIds = await searchRecipesByOutput(item.id);
        if (recipeIds.length > 0) {
          setHasRecipe(true);
          // Get the first recipe
          const recipe = await fetchRecipe(recipeIds[0]);
          // Fetch all ingredient items
          const ingredientIds = recipe.ingredients.map(ing => ing.item_id);
          const ingredientItems = await fetchItems(ingredientIds);
          
          // Отримуємо ціни інгредієнтів
          try {
            const prices = await fetchItemPrices(ingredientIds);
            const pricesMap: Record<number, ItemPrice> = {};
            prices.forEach((price: ItemPrice) => {
              pricesMap[price.id] = price;
            });
            setIngredientPrices(pricesMap);
          } catch (priceError) {
            console.error("Error fetching ingredient prices:", priceError);
          }
          
          setRecipeInfo({ recipe, ingredients: ingredientItems });
        } else {
          setHasRecipe(false);
        }
        
        // Отримуємо ціну предмета
        setLoadingPrice(true);
        try {
          const price = await fetchItemPrice(item.id);
          setItemPrice(price);
        } catch (error) {
          console.error("Error fetching item price:", error);
        } finally {
          setLoadingPrice(false);
        }
      } catch (error) {
        console.error("Error fetching recipe information:", error);
        setHasRecipe(false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const closePopup = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowTooltip(false);
  };

  // Додаємо/видаляємо предмет з улюблених
  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isFav) {
      removeFromFavorites(item.id);
    } else {
      addToFavorites(item.id);
    }
    
    setIsFav(!isFav);
  };

  // Get rarity-based class names
  const rarityClass = `rarity-${item.rarity.toLowerCase()}`;
  const textClass = `text-${item.rarity.toLowerCase()}`;
  const bgClass = `bg-${item.rarity.toLowerCase()}`;

  // Helper function to determine source
  const getItemSource = (ingredient: Item): string => {
    if (ingredient.flags.includes('AccountBound')) {
      return 'Account Bound';
    } else if (ingredient.type === 'CraftingMaterial') {
      if (ingredient.name.toLowerCase().includes('ore') || 
          ingredient.name.toLowerCase().includes('ingot')) {
        return 'Mining nodes';
      } else if (ingredient.name.toLowerCase().includes('wood') || 
                ingredient.name.toLowerCase().includes('plank') || 
                ingredient.name.toLowerCase().includes('log')) {
        return 'Chopping trees';
      } else if (ingredient.name.toLowerCase().includes('leather') || 
                ingredient.name.toLowerCase().includes('hide')) {
        return 'Salvaging leather gear';
      } else if (ingredient.name.toLowerCase().includes('cloth') || 
                ingredient.name.toLowerCase().includes('silk') || 
                ingredient.name.toLowerCase().includes('wool')) {
        return 'Salvaging cloth gear';
      } else {
        return 'Gathering or drops';
      }
    } else if (ingredient.type === 'Trophy') {
      return 'Monster drops';
    } else {
      return 'Trading Post';
    }
  };

  // Calculate total crafting cost from TP prices
  const calculateCraftCost = (): number | null => {
    if (!recipeInfo.recipe || !recipeInfo.ingredients) return null;
    
    let totalCost = 0;
    for (const ingredient of recipeInfo.ingredients) {
      const recipeIngredient = recipeInfo.recipe.ingredients.find(
        ing => ing.item_id === ingredient.id
      );
      const count = recipeIngredient?.count || 1;
      
      const ingredientPrice = ingredientPrices[ingredient.id];
      if (ingredientPrice && ingredientPrice.sells.unit_price > 0) {
        totalCost += ingredientPrice.sells.unit_price * count;
      } else {
        totalCost += ingredient.vendor_value * count;
      }
    }
    
    return totalCost;
  };

  return (
    <div className="item-card-container">
      {isCompareMode ? (
        <Link href={`/compare?item1=${compareItemId}&item2=${item.id}`} className="block h-full">
          <div 
            className={`item-card ${rarityClass} compare-mode`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="item-card-content">
              {item.icon && (
                <div className="item-image-container">
                  <Image 
                    src={item.icon} 
                    alt={item.name} 
                    width={64} 
                    height={64} 
                    className="item-image"
                  />
                </div>
              )}
              <div>
                <h3 className={`item-title ${textClass}`}>{item.name}</h3>
                <p className="item-type">{item.type}</p>
              </div>
              
              <div className="compare-indicator">
                Compare
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <Link href={`/items/${item.id}`} className="block h-full">
          <div 
            className={`item-card ${rarityClass} ${isHovering ? 'hover-shadow' : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => {
              e.preventDefault(); 
              handleCardClick();
            }}
          >
            <div className="item-card-content">
              {item.icon && (
                <div className="item-image-container">
                  <Image 
                    src={item.icon} 
                    alt={item.name} 
                    width={64} 
                    height={64} 
                    className="item-image"
                  />
                </div>
              )}
              <div>
                <h3 className={`item-title ${textClass}`}>{item.name}</h3>
                <p className="item-type">{item.type}</p>
              </div>
              
              {/* Рідкість та кнопка улюблених */}
              <div className="item-card-footer">
                <div className={`rarity-indicator ${bgClass}`}></div>
                <button 
                  className={`favorite-button ${isFav ? 'favorite-active' : ''}`}
                  onClick={toggleFavorite}
                  title={isFav ? "Видалити з улюблених" : "Додати до улюблених"}
                >
                  ★
                </button>
              </div>
            </div>
          </div>
        </Link>
      )}

      {showTooltip && !isCompareMode && (
        <div className="popup-overlay" onClick={closePopup}>
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <button className="popup-close" onClick={closePopup}>×</button>
            <div className="popup-header">
              {item.icon && (
                <Image 
                  src={item.icon} 
                  alt={item.name} 
                  width={64} 
                  height={64} 
                  className="popup-image"
                />
              )}
              <div className="popup-title-container">
                <h4 className={`popup-title ${textClass}`}>{item.name}</h4>
                <p className="popup-type">{item.type}</p>
              </div>
              <button 
                className={`favorite-button-large ${isFav ? 'favorite-active' : ''}`}
                onClick={toggleFavorite}
                title={isFav ? "Видалити з улюблених" : "Додати до улюблених"}
              >
                ★
              </button>
            </div>
            
            <p className="popup-description">{item.description || "No description available."}</p>
            
            <div className="popup-details">
              <p><span className="tooltip-label">Type:</span> {item.type}</p>
              <p><span className="tooltip-label">Rarity:</span> {item.rarity}</p>
              <p><span className="tooltip-label">Level:</span> {item.level}</p>
              <p><span className="tooltip-label">Value:</span> {item.vendor_value} coins</p>
              
              {/* Додаємо відображення цін торгового поста */}
              {loadingPrice && (
                <p><span className="tooltip-label">Trading Post:</span> Loading prices...</p>
              )}
              
            </div>
            {!loadingPrice && itemPrice && (
                <div className="popup-prices">
                  <p className="popup-price-title">Trading Post Prices:</p>
                  <div className="popup-price-details">
                    <p className="popup-price-item"><span style={{display: 'flex', alignItems: 'center'}} className="tooltip-label buy-price">Buy:</span> <span style={{display: 'flex', alignItems: 'center', gap: '4px'}} dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(itemPrice.buys.unit_price) }} /> <span className="tooltip-quantity">({itemPrice.buys.quantity} available)</span></p>
                    <p className="popup-price-item"><span style={{display: 'flex', alignItems: 'center'}} className="tooltip-label sell-price">Sell:</span> <span style={{display: 'flex', alignItems: 'center', gap: '4px'}} dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(itemPrice.sells.unit_price) }} /> <span className="tooltip-quantity">({itemPrice.sells.quantity} available)</span></p>
                  </div>
                </div>
              )}
            {isLoading && (
              <div className="popup-loading">
                <span className="tooltip-loading-spinner"></span>
                Loading recipe...
              </div>
            )}
            
            {!isLoading && hasRecipe === false && (
              <div className="popup-no-recipe">
                This item has no crafting recipe
                <p className="tooltip-more-details">
                  <span>
                    Click for more details 
                    <svg className="tooltip-arrow" viewBox="0 0 20 20">
                      <path fill="currentColor" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"></path>
                    </svg>
                  </span>
                </p>
              </div>
            )}
            
            {!isLoading && hasRecipe && recipeInfo.recipe && recipeInfo.ingredients && (
              <div>
                <h5 className="popup-recipe-title">Recipe:</h5>
                <div className="popup-recipe-details">
                  <p className="mb-1">
                    <span className="tooltip-label">Disciplines:</span> {recipeInfo.recipe.disciplines.join(', ')}
                  </p>
                  <p className="mb-1">
                    <span className="tooltip-label">Rating:</span> {recipeInfo.recipe.min_rating}
                  </p>
                  
                  {/* Відображаємо вартість крафту з TP цінами */}
                  {Object.keys(ingredientPrices).length > 0 && (
                    <div className="popup-crafting-cost">
                      <p className="mb-1">
                        <span className="tooltip-label">Crafting Cost:</span> <span dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(calculateCraftCost() || 0) }} />
                        {itemPrice && itemPrice.sells.unit_price > 0 && calculateCraftCost() && calculateCraftCost()! < itemPrice.sells.unit_price && (
                          <span className="craft-profit">
                            Profit: <span dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(itemPrice.sells.unit_price - calculateCraftCost()!) }} />
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="popup-recipe-list space-y-2">
                  {recipeInfo.recipe.ingredients.map((ingredient, index) => {
                    const ingredientItem = recipeInfo.ingredients?.find(i => i.id === ingredient.item_id);
                    if (!ingredientItem) return null;
                    
                    const ingredientTextClass = ingredientItem ? `text-${ingredientItem.rarity.toLowerCase()}` : '';
                    const ingredientPrice = ingredientPrices[ingredient.item_id];
                    const source = getItemSource(ingredientItem);
                    
                    return (
                      <div key={ingredient.item_id} className="popup-recipe-detail-item">
                        {ingredientItem?.icon && (
                          <Image 
                            src={ingredientItem.icon} 
                            alt={ingredientItem.name} 
                            width={24} 
                            height={24} 
                            className="tooltip-image"
                          />
                        )}
                        <div className="popup-recipe-item-info">
                          <div className="popup-recipe-item-name-row">
                            <span className={`popup-recipe-name ${ingredientTextClass}`}>
                              {ingredientItem?.name || `Item #${ingredient.item_id}`}
                            </span>
                            <span className="tooltip-recipe-count">x{ingredient.count}</span>
                          </div>
                          
                          <div className="popup-recipe-item-details">
                            <span className="popup-recipe-source">{source}</span>
                            {ingredientPrice && ingredientPrice.sells.unit_price > 0 && (
                              <span className="popup-recipe-price">
                                <span dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(ingredientPrice.sells.unit_price) }} /> 
                                <span className="popup-recipe-total">
                                  (Total: <span dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(ingredientPrice.sells.unit_price * ingredient.count) }} />)
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
              
            <div className="popup-footer">
              <Link href={`/items/${item.id}`} className="popup-link">
                View item details
              </Link>
              <Link 
                href={`/compare?item1=${item.id}`} 
                className="popup-compare-link"
                onClick={(e) => e.stopPropagation()}
              >
                Compare
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Додаємо функцію для фільтрації предметів
function filterItems(items: Item[], filters: FilterParams): Item[] {
  let filteredItems = [...items];
  
  // Фільтрація за пошуковим запитом
  if (filters.search && filters.search.trim()) {
    const searchQuery = filters.search.toLowerCase().trim();
    filteredItems = filteredItems.filter(item => 
      item.name.toLowerCase().includes(searchQuery) || 
      (item.description && item.description.toLowerCase().includes(searchQuery))
    );
  }
  
  // Фільтрація за рідкістю
  if (filters.rarities && filters.rarities.length > 0) {
    filteredItems = filteredItems.filter(item => 
      filters.rarities!.includes(item.rarity as ItemRarity)
    );
  }
  
  // Фільтрація за рівнем
  if (filters.minLevel !== undefined) {
    filteredItems = filteredItems.filter(item => item.level >= filters.minLevel!);
  }
  
  if (filters.maxLevel !== undefined) {
    filteredItems = filteredItems.filter(item => item.level <= filters.maxLevel!);
  }
  
  return filteredItems;
}