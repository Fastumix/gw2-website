import { Item, Recipe, ItemRarity, ItemPrice } from "@/types/gw2api";
import { 
  cacheItems, 
  cacheRecipes, 
  cachePrices, 
  getCachedItem, 
  getCachedItems, 
  getCachedRecipe, 
  getCachedRecipes, 
  getCachedPrice, 
  getCachedPrices,
  getAllCachedRecipeIds,
  shouldUpdateCache
} from "./cachingService";

const API_BASE_URL = "https://api.guildwars2.com/v2";

// Filter parameters interface
export interface FilterParams {
  search?: string;
  rarities?: ItemRarity[];
  minLevel?: number;
  maxLevel?: number;
}

// Cache to avoid repeated requests for the same data
const cache: Record<string, any> = {};

// Cache for all item IDs
let allItemsCache: Record<number, Item> = {};
let isLoadingAllItems = false;
let itemLoadProgress = 0;

// Cache for all item IDs
let allItemIdsCache: number[] | null = null;

/**
 * Get filtered items with caching for faster access
 * This helps avoid repeated API requests when changing filters
 */
const filterCache: Record<string, Item[]> = {};

/**
 * Get cache key for filters
 */
function getFilterCacheKey(category: string, filters: FilterParams): string {
  return `${category}:${JSON.stringify(filters)}`;
}

/**
 * Clear filter cache
 */
export function clearFilterCache(): void {
  Object.keys(filterCache).forEach(key => {
    delete filterCache[key];
  });
}

/**
 * Handle API error and log
 */
function handleApiError(error: any, context: string): void {
  console.error(`GW2 API Error (${context}):`, error);
  // In a real app, you could add telemetry or error notifications here
}

/**
 * Initialize item preloading in background
 */
export async function initializeItemPreloading(): Promise<void> {
  if (isLoadingAllItems) return;
  
  isLoadingAllItems = true;
  itemLoadProgress = 0;
  
  try {
    // First get all IDs
    const allIds = await fetchAllItemIds();
    
    // Split into smaller groups for sequential loading
    const chunkSize = 200; // API limit
    const chunks = [];
    
    for (let i = 0; i < allIds.length; i += chunkSize) {
      chunks.push(allIds.slice(i, i + chunkSize));
    }
    
    console.log(`Starting to load ${allIds.length} items in ${chunks.length} chunks`);
    
    // Load first few chunks for quick access
    const initialChunks = chunks.slice(0, 5);
    for (const chunk of initialChunks) {
      try {
        const items = await fetchItems(chunk);
        items.forEach(item => {
          allItemsCache[item.id] = item;
        });
        
        itemLoadProgress += chunk.length;
        console.log(`Loaded ${itemLoadProgress} of ${allIds.length} items (${Math.round(itemLoadProgress / allIds.length * 100)}%)`);
      } catch (error) {
        console.error('Error loading chunk:', error);
      }
    }
    
    // Load the rest in background
    (async () => {
      const remainingChunks = chunks.slice(5);
      for (const chunk of remainingChunks) {
        try {
          const items = await fetchItems(chunk);
          items.forEach(item => {
            allItemsCache[item.id] = item;
          });
          
          itemLoadProgress += chunk.length;
          console.log(`Loaded ${itemLoadProgress} of ${allIds.length} items (${Math.round(itemLoadProgress / allIds.length * 100)}%)`);
        } catch (error) {
          console.error('Error loading chunk:', error);
        }
        
        // Pause between requests to prevent API overload
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      console.log('Loading of all items completed');
      isLoadingAllItems = false;
    })();
    
  } catch (error) {
    console.error('Error initializing item loading:', error);
    isLoadingAllItems = false;
  }
}

/**
 * Get item loading status
 */
export function getItemLoadingStatus(): { isLoading: boolean, progress: number } {
  return {
    isLoading: isLoadingAllItems,
    progress: itemLoadProgress
  };
}

/**
 * Get count of loaded items
 */
export function getLoadedItemsCount(): number {
  return Object.keys(allItemsCache).length;
}

/**
 * Get all loaded items
 */
export function getAllLoadedItems(): Item[] {
  return Object.values(allItemsCache);
}

/**
 * Sort all items by rarity
 */
export function getSortedItemsByRarity(category: string = 'all'): Item[] {
  const allItems = getAllLoadedItems();
  
  // Filter by category if needed
  const filteredItems = category === 'all' 
    ? allItems 
    : allItems.filter(item => isItemInCategory(item, category));
  
  // Sort by rarity
  return sortItemsByRarity(filteredItems);
}

/**
 * Base method for API requests
 */
async function fetchFromAPI<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
  // Create URL with parameters
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      queryParams.append(key, value.join(','));
    } else if (value !== undefined) {
      queryParams.append(key, value.toString());
    }
  });

  const urlWithParams = `${API_BASE_URL}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  // Check cache
  if (cache[urlWithParams]) {
    return cache[urlWithParams] as T;
  }

  try {
    const response = await fetch(urlWithParams);
    
    if (!response.ok) {
      // For recipe endpoints, return an empty result instead of failing completely
      if (endpoint.includes('/recipes') && response.status === 404) {
        console.warn(`Recipe not found: ${urlWithParams}`);
        // Return empty array for recipe requests
        if (Array.isArray(params.ids) || endpoint === '/recipes') {
          return [] as unknown as T;
        } else {
          // Return a minimal recipe object
          return {} as T;
        }
      }
      
      // For commerce/prices endpoints, return empty prices instead of failing
      if (endpoint.includes('/commerce/prices') && response.status === 404) {
        console.warn(`Price not found: ${urlWithParams}`);
        // Return empty array for price requests
        if (Array.isArray(params.ids) || endpoint === '/commerce/prices') {
          return [] as unknown as T;
        } else {
          // For a specific price, extract ID from the endpoint and return a placeholder
          const idMatch = endpoint.match(/\/commerce\/prices\/(\d+)$/);
          const id = idMatch ? parseInt(idMatch[1]) : 0;
          
          // Return a minimal price object
          return {
            id,
            whitelisted: false,
            buys: { quantity: 0, unit_price: 0 },
            sells: { quantity: 0, unit_price: 0 }
          } as unknown as T;
        }
      }
      
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    // Save to cache
    cache[urlWithParams] = data;
    return data as T;
  } catch (error) {
    console.error('Error fetching from API:', error);
    
    // Handle specific errors for recipe API
    if (endpoint.includes('/recipes')) {
      // Return empty array for recipe requests
      if (Array.isArray(params.ids) || endpoint === '/recipes') {
        return [] as unknown as T;
      }
    }
    
    // Handle specific errors for prices API
    if (endpoint.includes('/commerce/prices')) {
      // Return empty array for price requests
      if (Array.isArray(params.ids) || endpoint === '/commerce/prices') {
        return [] as unknown as T;
      }
      
      // For a specific price, extract ID from the endpoint and return a placeholder
      const idMatch = endpoint.match(/\/commerce\/prices\/(\d+)$/);
      const id = idMatch ? parseInt(idMatch[1]) : 0;
      
      // Return a minimal price object
      return {
        id,
        whitelisted: false,
        buys: { quantity: 0, unit_price: 0 },
        sells: { quantity: 0, unit_price: 0 }
      } as unknown as T;
    }
    
    throw error;
  }
}

/**
 * Get all available item IDs with caching
 */
export async function fetchAllItemIds(): Promise<number[]> {
  if (allItemIdsCache) {
    return allItemIdsCache;
  }
  
  try {
    const ids = await fetchFromAPI<number[]>('/items');
    allItemIdsCache = ids;
    return ids;
  } catch (error) {
    console.error('Failed to fetch all item IDs:', error);
    // Return a combined list of our predefined IDs as a fallback
    return [...allCategoriesIds];
  }
}

/**
 * Get items with pagination
 */
export async function fetchItemsPage(page: number = 0, pageSize: number = 50): Promise<Item[]> {
  return fetchFromAPI<Item[]>('/items', { page, page_size: pageSize });
}

/**
 * Get specific items by their IDs with caching
 */
export async function fetchItems(ids: number[]): Promise<Item[]> {
  if (!ids || ids.length === 0) return [];
  
  // Try to get items from cache first
  const cachedItems = await getCachedItems(ids);
  const cachedItemsMap = new Map<number, Item>(cachedItems.map(item => [item.id, item]));
  
  // Find missing items that need to be fetched
  const missingIds = ids.filter(id => !cachedItemsMap.has(id));
  
  // If all items are already in cache, return them
  if (missingIds.length === 0) {
    return ids.map(id => cachedItemsMap.get(id)!).filter(Boolean);
  }
  
  // API has a limit on the number of IDs in one request
  const maxIdsPerRequest = 200;
  
  // Fetch missing items
  let newItems: Item[] = [];
  
  if (missingIds.length <= maxIdsPerRequest) {
    try {
      const items = await fetchFromAPI<Item[]>('/items', { ids: missingIds });
      newItems = items;
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  } else {
    // Split into smaller groups if too many IDs
    for (let i = 0; i < missingIds.length; i += maxIdsPerRequest) {
      const chunk = missingIds.slice(i, i + maxIdsPerRequest);
      try {
        const items = await fetchFromAPI<Item[]>('/items', { ids: chunk });
        newItems.push(...items);
      } catch (error) {
        console.error(`Error fetching items chunk ${i}-${i+maxIdsPerRequest}:`, error);
      }
    }
  }
  
  // Cache the newly fetched items
  if (newItems.length > 0) {
    try {
      await cacheItems(newItems);
    } catch (error) {
      console.error('Error caching items:', error);
    }
  }
  
  // Combine cached and newly fetched items
  const allItemsMap = new Map<number, Item>([
    ...Array.from(cachedItemsMap.entries()),
    ...newItems.map(item => [item.id, item] as [number, Item])
  ]);
  
  // Return items in the same order as requested
  return ids.map(id => allItemsMap.get(id)).filter(Boolean) as Item[];
}

/**
 * Get one item by its ID with caching
 */
export async function fetchItem(id: number): Promise<Item> {
  // Try to get item from cache first
  const cachedItem = await getCachedItem(id);
  if (cachedItem) {
    return cachedItem;
  }
  
  // If not in cache, fetch from API
  try {
    const item = await fetchFromAPI<Item>(`/items/${id}`);
    
    // Cache the newly fetched item
    await cacheItems([item]);
    
    return item;
  } catch (error) {
    console.error(`Error fetching item ${id}:`, error);
    throw error;
  }
}

/**
 * Get popular items or items from fallback data
 */
export async function fetchPopularItems(): Promise<Item[]> {
  try {
    // Use our expanded lists of popular items 
    // and sort them by rarity from highest to lowest
    const items = await optimizedFetchItems(popularItemIds, "popular-items");
    return sortItemsByRarity(items);
  } catch (error) {
    handleApiError(error, "fetchPopularItems");
    return sortItemsByRarity(getFallbackItems());
  }
}

/**
 * Get rarity order number for sorting
 * @param rarity Item rarity
 */
function getRarityOrder(rarity: string | undefined): number {
  if (!rarity) return 0;
  
  switch (rarity) {
    case 'Legendary': return 8;
    case 'Ascended': return 7;
    case 'Exotic': return 6;
    case 'Rare': return 5;
    case 'Masterwork': return 4;
    case 'Fine': return 3;
    case 'Basic': return 2;
    case 'Junk': return 1;
    default: return 0;
  }
}

/**
 * Sort items by rarity (highest to lowest)
 */
function sortItemsByRarity(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const rarityOrderA = getRarityOrder(a.rarity);
    const rarityOrderB = getRarityOrder(b.rarity);
    return rarityOrderB - rarityOrderA;
  });
}

/**
 * Filter items based on given criteria
 * @param items List of items to filter
 * @param filters Filter parameters
 */
function filterItems(items: Item[], filters: FilterParams): Item[] {
  let filteredItems = [...items];
  
  // Filter by search query
  if (filters.search && filters.search.trim()) {
    const searchQuery = filters.search.toLowerCase().trim();
    filteredItems = filteredItems.filter(item => 
      item.name.toLowerCase().includes(searchQuery) || 
      (item.description && item.description.toLowerCase().includes(searchQuery)) ||
      (item.type && item.type.toLowerCase().includes(searchQuery))
    );
  }
  
  // Filter by rarity
  if (filters.rarities && filters.rarities.length > 0) {
    filteredItems = filteredItems.filter(item => 
      item.rarity && filters.rarities!.includes(item.rarity as ItemRarity)
    );
  }
  
  // Filter by level
  if (filters.minLevel !== undefined) {
    filteredItems = filteredItems.filter(item => 
      item.level >= filters.minLevel!
    );
  }
  
  if (filters.maxLevel !== undefined) {
    filteredItems = filteredItems.filter(item => 
      item.level <= filters.maxLevel!
    );
  }
  
  return filteredItems;
}

/**
 * Check if an item belongs to a specific category
 * @param item Item to check
 * @param category Category to check against
 */
function isItemInCategory(item: Item, category: string): boolean {
  if (category === 'all') {
    return true;
  }
  
  // Basic check - does the item type match the category
  if (item.type === category) {
    return true;
  }
  
  // Additional checks for specific categories
  switch (category) {
    case 'CraftingMaterial':
      return item.type === 'CraftingMaterial' || 
             !!(item.description && item.description.toLowerCase().includes('crafting'));
      
    case 'Weapon':
      return item.type === 'Weapon' || 
             ['axe', 'dagger', 'focus', 'greatsword', 'hammer', 'harpoon', 'longbow', 'mace',
              'pistol', 'rifle', 'scepter', 'shield', 'shortbow', 'speargun', 'staff', 'sword',
              'torch', 'trident', 'warhorn'].some(type => 
                item.name.toLowerCase().includes(type) || 
                !!(item.description && item.description.toLowerCase().includes(type))
              );
      
    case 'Armor':
      return item.type === 'Armor' || 
             ['helm', 'shoulders', 'coat', 'gloves', 'leggings', 'boots', 'headgear', 
              'mantle', 'vestments', 'gauntlets', 'tassets', 'footgear', 'helmet', 
              'pauldrons', 'chestpiece', 'handwear', 'legwear', 'footwear'].some(type => 
                item.name.toLowerCase().includes(type) || 
                !!(item.description && item.description.toLowerCase().includes(type))
              );
      
    case 'Consumable':
      return item.type === 'Consumable' || 
             item.type === 'Trophy' || 
             item.type === 'Gizmo' || 
             // 'Food' is not a valid type in the API, so removing it from check
             ['potion', 'elixir', 'food', 'utility', 'feast', 'boost'].some(type => 
                item.name.toLowerCase().includes(type) || 
                !!(item.description && item.description.toLowerCase().includes(type))
              );
      
    default:
      return item.type === category;
  }
}

/**
 * Get items by category with pagination and filters
 */
export async function fetchItemsByCategory(
  category: string, 
  page: number = 0, 
  pageSize: number = 50, 
  filters: FilterParams = {}
): Promise<{ items: Item[], totalCount: number, hasMore: boolean }> {
  try {
    // Start loading all items if not already started
    if (Object.keys(allItemsCache).length === 0 && !isLoadingAllItems) {
      initializeItemPreloading();
    }
    
    // Check if results are in cache
    const cacheKey = getFilterCacheKey(category, filters);
    
    // If there are active filters and cache has results for this key
    if (Object.keys(filters).length > 0 && filterCache[cacheKey]) {
      const cachedItems = filterCache[cacheKey];
      const startIndex = page * pageSize;
      const endIndex = Math.min(cachedItems.length, startIndex + pageSize);
      const paginatedItems = cachedItems.slice(startIndex, endIndex);
      
      return {
        items: paginatedItems,
        totalCount: cachedItems.length,
        hasMore: endIndex < cachedItems.length
      };
    }
    
    // Use all items cache if available
    if (Object.keys(allItemsCache).length > 1000) {
      const allItems = getAllLoadedItems();
      
      // First filter by category
      let categoryFilteredItems = allItems;
      if (category !== 'all') {
        categoryFilteredItems = allItems.filter(item => isItemInCategory(item, category));
      }
      
      // Apply user filters
      const filteredItems = filterItems(categoryFilteredItems, filters);
      
      // Sort by rarity
      const sortedItems = sortItemsByRarity(filteredItems);
      
      // Save to filter cache
      filterCache[cacheKey] = sortedItems;
      
      // Prepare data for pagination
      const startIndex = page * pageSize;
      const endIndex = Math.min(sortedItems.length, startIndex + pageSize);
      const paginatedItems = sortedItems.slice(startIndex, endIndex);
      
      return {
        items: paginatedItems,
        totalCount: sortedItems.length,
        hasMore: endIndex < sortedItems.length
      };
    }
    
    // If all items cache is not yet filled, use standard approach
    let allIds: number[] = [];
    
    // Get IDs based on category
    if (category === 'all') {
      allIds = await fetchAllItemIds();
    } else if (category === 'CraftingMaterial') {
      allIds = craftingMaterialIds;
    } else if (category === 'Weapon') {
      allIds = weaponIds;
    } else if (category === 'Armor') {
      allIds = armorIds;
    } else if (category === 'Consumable') {
      allIds = consumableIds;
    } else {
      allIds = await fetchAllItemIds();
    }
    
    // For more accurate filter results
    const batchSize = 200;
    let allLoadedItems: Item[] = [];
    
    // Load as many items as possible in limited time
    const maxBatches = 10; // Limit number of requests
    
    for (let i = 0; i < Math.min(maxBatches, Math.ceil(allIds.length / batchSize)); i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, allIds.length);
      const batchIds = allIds.slice(start, end);
      
      if (batchIds.length === 0) break;
      
      try {
        const items = await optimizedFetchItems(batchIds, `category-global-${category}`);
        
        // Save to all items cache
        items.forEach(item => {
          allItemsCache[item.id] = item;
        });
        
        allLoadedItems = [...allLoadedItems, ...items];
      } catch (error) {
        console.error(`Error loading batch ${i}:`, error);
      }
    }
    
    // If we couldn't load all items due to limits,
    // start background loading of all items
    if (allIds.length > maxBatches * batchSize && !isLoadingAllItems) {
      initializeItemPreloading();
    }
    
    // Filter by category
    let categoryFilteredItems = allLoadedItems;
      if (category !== 'all') {
      categoryFilteredItems = allLoadedItems.filter(item => isItemInCategory(item, category));
    }
    
    // Apply user filters
    const filteredItems = filterItems(categoryFilteredItems, filters);
    
    // Sort by rarity
    const sortedItems = sortItemsByRarity(filteredItems);
    
    // Save to filter cache
    filterCache[cacheKey] = sortedItems;
    
    // Prepare data for pagination
    const startIndex = page * pageSize;
    const endIndex = Math.min(sortedItems.length, startIndex + pageSize);
    const paginatedItems = sortedItems.slice(startIndex, endIndex);
      
      return {
      items: paginatedItems.length > 0 ? paginatedItems : sortItemsByRarity(getFallbackItemsByCategory(category)),
      totalCount: sortedItems.length,
      hasMore: endIndex < sortedItems.length
    };
  } catch (error) {
    console.error(`Failed to fetch items for category ${category}:`, error);
    
    // In case of error, use fallback data
    const fallbackItems = sortItemsByRarity(getFallbackItemsByCategory(category));
    
    return {
      items: fallbackItems,
      totalCount: fallbackItems.length,
      hasMore: false
    };
  }
}

/**
 * Search for recipes by output item
 */
export async function searchRecipesByOutput(outputItemId: number): Promise<number[]> {
  try {
    return fetchFromAPI<number[]>('/recipes/search', { output: outputItemId });
  } catch (error) {
    console.error(`Failed to search recipes for output ${outputItemId}:`, error);
    return [];
  }
}

/**
 * Get recipe by its ID with caching
 */
export async function fetchRecipe(id: number): Promise<Recipe> {
  // Try to get recipe from cache first
  const cachedRecipe = await getCachedRecipe(id);
  if (cachedRecipe) {
    return cachedRecipe;
  }
  
  // If not in cache, fetch from API
  try {
    const recipe = await fetchFromAPI<Recipe>(`/recipes/${id}`);
    
    // Cache the newly fetched recipe
    await cacheRecipes([recipe]);
    
    return recipe;
  } catch (error) {
    console.error(`Error fetching recipe ${id}:`, error);
    throw error;
  }
}

/**
 * Fallback data in case API is unavailable
 */
function getFallbackItems(): Item[] {
  // Basic fallback data for different item types
  return [
    // Crafting Materials
    {
      id: 19721,
      name: "Glob of Ectoplasm",
      icon: "https://render.guildwars2.com/file/18CE5D78317265000CF3C23ED76AB3CEE86BA60E/65941.png",
      description: "Salvage Item",
      type: "Trophy",
      rarity: "Exotic",
      level: 0,
      vendor_value: 256,
      chat_link: "[&AgEJTQAA]",
      flags: [],
      game_types: ["Activity", "Wvw", "Dungeon", "Pve"],
      restrictions: []
    },
    {
      id: 19685,
      name: "Orichalcum Ingot",
      icon: "https://render.guildwars2.com/file/D1941454313ACCB234906840E1FB401D49091B96/220460.png",
      description: "Refined from Ore.",
      type: "CraftingMaterial",
      rarity: "Basic",
      level: 0,
      vendor_value: 8,
      chat_link: "[&AgHlTAAA]",
      flags: ["NoSalvage"],
      game_types: ["Activity", "Wvw", "Dungeon", "Pve"],
      restrictions: []
    },
    {
      id: 19719,
      name: "Rawhide Leather Section",
      icon: "https://render.guildwars2.com/file/0CB8030AD26C3C7563B10E5EC397490F991ED795/65940.png",
      description: "Refine into Squares.",
      type: "CraftingMaterial",
      rarity: "Basic",
      level: 0,
      vendor_value: 2,
      chat_link: "[&AgEHTQAA]",
      flags: ["NoSalvage"],
      game_types: ["Activity", "Wvw", "Dungeon", "Pve"],
      restrictions: []
    },
    {
      id: 19723,
      name: "Green Wood Log",
      icon: "https://render.guildwars2.com/file/DAF50142ADC06FB11FBC02F8FFEF504F4E674047/65942.png",
      description: "Refine into Planks.",
      type: "CraftingMaterial",
      rarity: "Basic",
      level: 0,
      vendor_value: 2,
      chat_link: "[&AgELTQAA]",
      flags: ["NoSalvage"],
      game_types: ["Activity", "Wvw", "Dungeon", "Pve"],
      restrictions: []
    },
    {
      id: 19726,
      name: "Soft Wood Log",
      icon: "https://render.guildwars2.com/file/AB6C5501209B91D9B890B1F84B29BC0142CB59D8/65943.png",
      description: "Refine into Planks.",
      type: "CraftingMaterial",
      rarity: "Basic",
      level: 0,
      vendor_value: 3,
      chat_link: "[&AgEOTQAA]",
      flags: ["NoSalvage"],
      game_types: ["Activity", "Wvw", "Dungeon", "Pve"],
      restrictions: []
    },
    {
      id: 19790,
      name: "Spool of Gossamer Thread",
      icon: "https://render.guildwars2.com/file/B7CFD70F53A845E4ED1212040C18C123FC172910/65959.png",
      description: "",
      type: "CraftingMaterial",
      rarity: "Basic",
      level: 0,
      vendor_value: 8,
      chat_link: "[&AgFOTQAA]",
      flags: ["NoSalvage"],
      game_types: ["Activity", "Wvw", "Dungeon", "Pve"],
      restrictions: []
    },
    
    // Weapons
    {
      id: 30684,
      name: "Frostfang",
      icon: "https://render.guildwars2.com/file/0F9C08DE12ADD1082A103DC6EF7401281B23985E/456009.png",
      description: "",
      type: "Weapon",
      rarity: "Legendary",
      level: 80,
      vendor_value: 100000,
      chat_link: "[&AgHcdwAA]",
      flags: ["HideSuffix", "NoSalvage", "NoSell", "AccountBindOnUse", "DeleteWarning"],
      game_types: ["Activity", "Wvw", "Dungeon", "Pve"],
      restrictions: []
    },
    {
      id: 30696,
      name: "The Flameseeker Prophecies",
      icon: "https://render.guildwars2.com/file/BE58181BEA0559E60873ED940D0408D0596B4464/456021.png",
      description: "",
      type: "Weapon",
      rarity: "Legendary",
      level: 80,
      vendor_value: 100000,
      chat_link: "[&AgHodwAA]",
      flags: ["HideSuffix", "NoSalvage", "NoSell", "AccountBindOnUse", "DeleteWarning"],
      game_types: ["Activity", "Wvw", "Dungeon", "Pve"],
      restrictions: []
    },
    
    // Armor
    {
      id: 75915,
      name: "Recipe: Svaard's Visor",
      icon: "https://render.guildwars2.com/file/AC1C3075784E0C4235BD9E22E1752D6B49D66F0F/849281.png",
      description: "A recipe to make an ascended heavy helm with Marauder (+Power, +Precision, +Vitality, and +Ferocity) stats.",
      type: "Consumable",
      rarity: "Ascended",
      level: 0,
      vendor_value: 160,
      chat_link: "[&AgGLKAEA]",
      flags: ["NoSalvage", "NoSell"],
      game_types: ["PvpLobby", "Wvw", "Dungeon", "Pve"],
      restrictions: []
    },
    {
      id: 76361,
      name: "Marauder Orichalcum Imbued Inscription",
      icon: "https://render.guildwars2.com/file/BEA0A8F95A27416DEF034567CC592EB4DB7D4A56/904678.png",
      description: "Used in the crafting of weapons with +Power, +Precision, +Vitality, and +Ferocity.",
      type: "CraftingMaterial",
      rarity: "Exotic",
      level: 80,
      vendor_value: 66,
      chat_link: "[&AgFJKgEA]",
      flags: ["AccountBound", "NoSalvage", "AccountBindOnUse"],
      game_types: ["Activity", "Wvw", "Dungeon", "Pve"],
      restrictions: []
    },
    
    // Consumables
    {
      id: 91126,
      name: "Vision of Enemies: Death-Branded Shatterer",
      icon: "https://render.guildwars2.com/file/9E55797F620E6112030BD53A055CEEF6BD6B263E/2149881.png",
      description: "Hint: Defeat the Death-Branded Shatterer within Jahai Bluffs while holding a Memory Essence Encapsulator in your inventory.",
      type: "Trophy",
      rarity: "Exotic",
      level: 0,
      vendor_value: 1000,
      chat_link: "[&AgH2YwEA]",
      flags: ["AccountBound", "NoSell", "Unique", "AccountBindOnUse"],
      game_types: ["Wvw", "Dungeon", "Pve"],
      restrictions: []
    },
    {
      id: 12450,
      name: "Bowl of Artichoke Soup",
      icon: "https://render.guildwars2.com/file/DE00D79EB802977C37599250A1FE6CD4CF7CB1F8/433641.png",
      description: "",
      type: "Consumable",
      rarity: "Fine",
      level: 75,
      vendor_value: 33,
      chat_link: "[&AgGiMAAA]",
      flags: ["NoSell"],
      game_types: ["Wvw", "Dungeon", "Pve"],
      restrictions: []
    }
  ];
}

/**
 * Fallback data for specific category
 */
function getFallbackItemsByCategory(category: string): Item[] {
  const allFallbackItems = getFallbackItems();
  if (category === 'all') {
    return allFallbackItems;
  }
  
  // Use our isItemInCategory function for more accurate item classification
  return allFallbackItems.filter(item => isItemInCategory(item, category));
}

/**
 * Optimized search for items by IDs
 */
async function optimizedFetchItems(ids: number[], context: string = "general"): Promise<Item[]> {
  if (!ids || ids.length === 0) return [];
  
  try {
    return await fetchItems(ids);
  } catch (error) {
    handleApiError(error, `optimizedFetchItems-${context}`);
    
    // Try to load items one by one to get at least some results
    const results: Item[] = [];
    
    // Use Promise.allSettled to load items in parallel
    const promises = ids.slice(0, 50).map(id => fetchItem(id).catch(() => null));
    const settledResults = await Promise.allSettled(promises);
    
    settledResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    });
    
    return results;
  }
}

/**
 * Fetch recipes by IDs with caching
 */
export async function fetchRecipes(ids: number[]): Promise<Recipe[]> {
  if (ids.length === 0) {
    return [];
  }
  
  // Try to get recipes from cache first
  const cachedRecipes = await getCachedRecipes(ids);
  const cachedRecipesMap = new Map<number, Recipe>(cachedRecipes.map(recipe => [recipe.id, recipe]));
  
  // Find missing recipes that need to be fetched
  const missingIds = ids.filter(id => !cachedRecipesMap.has(id));
  
  // If all recipes are already in cache, return them
  if (missingIds.length === 0) {
    return ids.map(id => cachedRecipesMap.get(id)!).filter(Boolean);
  }
  
  // Fetch missing recipes
  let newRecipes: Recipe[] = [];
  
  try {
    const idsParam = missingIds.join(',');
    const response = await fetch(`${API_BASE_URL}/recipes?ids=${idsParam}`);
    
    if (!response.ok) {
      console.warn(`Error fetching recipes: ${response.status} ${response.statusText}`);
    } else {
      newRecipes = await response.json();
      
      // Cache the newly fetched recipes
      if (newRecipes.length > 0) {
        try {
          await cacheRecipes(newRecipes);
        } catch (error) {
          console.error('Error caching recipes:', error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch recipes:', error);
  }
  
  // Combine cached and newly fetched recipes
  const allRecipesMap = new Map<number, Recipe>([
    ...Array.from(cachedRecipesMap.entries()),
    ...newRecipes.map(recipe => [recipe.id, recipe] as [number, Recipe])
  ]);
  
  // Return recipes in the same order as requested
  return ids.map(id => allRecipesMap.get(id)).filter(Boolean) as Recipe[];
}

// Get popular crafting materials
export const craftingMaterialIds = [
  19721, // Glob of Ectoplasm
  19685, // Orichalcum Ingot
  19719, // Rawhide Leather Section
  19723, // Green Wood Log
  19726, // Soft Wood Log
  19790, // Spool of Gossamer Thread
  19687, // Pile of Crystalline Dust
  19699, // Cured Hardened Leather Square
  19698, // Bolt of Gossamer
  19701, // Orichalcum Ingot
  19924, // Vial of Powerful Blood
  19976, // Intricate Gossamer Insignia
  19925, // Vicious Fang
  19748, // Silk Scrap
  19745, // Thin Leather Section
  19732, // Iron Ore
  // Additional IDs to improve category content
  19680, // Iron Ingot
  19679, // Steel Ingot
  19683, // Darksteel Ingot
  19687, // Mithril Ingot
  19681, // Gold Ingot
  19682, // Platinum Ingot
  19684, // Silver Ingot
  24276, // Pile of Incandescent Dust
  24277, // Pile of Luminous Dust
  24294, // Elaborate Totem
  24295, // Intricate Totem
  24341, // Large Bone
  24350, // Large Claw
  24356, // Large Fang
  24358, // Large Scale
  24363, // Potent Venom Sac
  24276, // Ancient Bone
  24358, // Vicious Claw
  24341, // Armored Scale
  24350, // Karka Shell
];

// Exotic weapons
export const weaponIds = [
  30684, // The Bifrost
  30696, // Incinerator
  30695, // The Dreamer
  30688, // Frostfang
  30691, // Eternity
  30692, // Kraitkin
  30702, // Flameseeker Prophecies
  71383, // Chuka and Champawat
  76158, // Astralaria
  30698, // Howler
  // Additional IDs to improve category content
  30686, // Sunrise
  30687, // Twilight
  30689, // Bolt
  30690, // Rodgort
  30693, // Kamohoali'i Kotaki
  30696, // The Moot
  30697, // The Juggernaut
  30699, // Quip
  30700, // Meteorlogicus
  30701, // The Predator
  30703, // Kudzu
  30704, // The Minstrel
  46774, // Infinite Light
  46760, // Mjolnir
  46762, // The Anomaly
  48896, // Firebringer
  48911, // Wintersbite
  48929, // Jormag's Breath
  48913, // Naegling
];

// Armor items
export const armorIds = [
  75915, // Nightfury
  72156, // Refined Envoy Helmet
  76361, // Perfected Envoy Mantle
  76073, // Perfected Envoy Greaves
  72339, // Monk's Outfit
  80661, // Sublime Mistforged Triumphant Hero's armor
  68786, // Bladed Coat
  70823, // Ascalonian Sentry Shoulderguards
  71994, // Chaos Gloves
  60410, // Apostle Mantle
  // Additional IDs to improve category content
  48073, // Ascalonian Performer Boots
  48078, // Ascalonian Performer Coat
  48075, // Ascalonian Performer Mask
  48077, // Ascalonian Performer Pants
  48074, // Ascalonian Performer Gloves
  48076, // Ascalonian Performer Shoulders
  48884, // Flame Legion Boots
  48885, // Flame Legion Coat
  48888, // Flame Legion Gloves
  48886, // Flame Legion Helm
  48889, // Flame Legion Leggings
  48887, // Flame Legion Shoulders
  49507, // Illustrious Cowl
  49510, // Illustrious Raiments
  49508, // Illustrious Wristguards
  75820, // Bladed Boots
  75591, // Bladed Helm
  76010, // Bladed Leggings
  75436, // Bladed Shoulders
];

// Consumable items
export const consumableIds = [
  91126, // Superior Sharpening Stone
  91191, // Superior Rune of Strength
  91232, // Superior Sigil of Force
  12450, // Superior Rune of the Scholar
  49432, // Crystal of Power
  91796, // Birthday Cake
  97462, // Zhaitaffy
  12165, // Omnomberry Bar
  8764, // Flask of Firewater
  43360, // Crystal Oasis Portal Scroll
  // Additional IDs to improve category content
  12157, // Omnomberry Pie
  12151, // Bowl of Curry Butternut Squash Soup
  12153, // Bowl of Truffle Risotto
  12156, // Plate of Orrian Steak Frittes
  12271, // Bowl of Krytian Vegetable Stirfry
  12337, // Bowl of Meat and Bean Chili
  12338, // Bowl of Gelatinous Ice Cream
  12339, // Bowl of Chocolate Chip Ice Cream
  12344, // Mango Pie
  12346, // Strawberry Pie
  12347, // Cherry Pie
  12350, // Chocolate Cake
  12472, // Omnomberry Ghost
  12544, // Glazed Pear Tart
  12550, // Bowl of Peach Raspberry Swirl Ice Cream
  36760, // Strawberry Ghost
  36779, // Bowl of Bloodstone Bisque
  36829, // Bowl of Fire Flank Steak
  36833, // Bowl of Garlic Kale Sautee
];

// Combined list of all item IDs
export const allCategoriesIds = [
  ...craftingMaterialIds,
  ...weaponIds,
  ...armorIds,
  ...consumableIds
];

// Combine all item categories for the main grid
export const popularItemIds = [
  ...craftingMaterialIds.slice(0, 8),
  ...weaponIds.slice(0, 4),
  ...armorIds.slice(0, 4),
  ...consumableIds.slice(0, 4),
];

/**
 * Отримати ціни торгового поста для предмета за його ID з кешуванням
 */
export async function fetchItemPrice(id: number): Promise<ItemPrice> {
  // Try to get price from cache first
  const cachedPrice = await getCachedPrice(id);
  
  // If price is in cache and not too old (less than 1 hour), return it
  const shouldUpdate = await shouldUpdateCache('prices', 1); // 1 hour max age for prices
  if (cachedPrice && !shouldUpdate) {
    return cachedPrice;
  }
  
  // If not in cache or too old, fetch from API
  try {
    const price = await fetchFromAPI<ItemPrice>('/commerce/prices/' + id);
    
    // Cache the newly fetched price
    await cachePrices([price]);
    
    return price;
  } catch (error) {
    handleApiError(error, "fetchItemPrice");
    
    // If we have a cached price even if old, return it as fallback
    if (cachedPrice) {
      return cachedPrice;
    }
    
    // Otherwise return empty values for price
    return {
      id,
      whitelisted: false,
      buys: { quantity: 0, unit_price: 0 },
      sells: { quantity: 0, unit_price: 0 }
    };
  }
}

/**
 * Отримати ціни торгового поста для кількох предметів за їх ID з кешуванням
 */
export async function fetchItemPrices(ids: number[]): Promise<ItemPrice[]> {
  if (!ids || ids.length === 0) return [];
  
  // Try to get prices from cache first
  const cachedPrices = await getCachedPrices(ids);
  const cachedPricesMap = new Map<number, ItemPrice>(cachedPrices.map(price => [price.id, price]));
  
  // Check if prices need to be updated (older than 1 hour)
  const shouldUpdate = await shouldUpdateCache('prices', 1); // 1 hour max age for prices
  
  // If all prices are in cache and not too old, return them
  if (cachedPrices.length === ids.length && !shouldUpdate) {
    return ids.map(id => cachedPricesMap.get(id)!);
  }
  
  // Find missing prices that need to be fetched
  const missingIds = ids.filter(id => !cachedPricesMap.has(id));
  const idsToFetch = shouldUpdate ? ids : missingIds;
  
  if (idsToFetch.length === 0) {
    return cachedPrices;
  }
  
  // API has a limit on the number of IDs in one request
  const maxIdsPerRequest = 200;
  
  // Fetch prices
  let newPrices: ItemPrice[] = [];
  
  if (idsToFetch.length <= maxIdsPerRequest) {
    try {
      newPrices = await fetchFromAPI<ItemPrice[]>('/commerce/prices', { ids: idsToFetch });
    } catch (error) {
      handleApiError(error, "fetchItemPrices");
    }
  } else {
    // Split into smaller groups if too many IDs
    for (let i = 0; i < idsToFetch.length; i += maxIdsPerRequest) {
      const chunk = idsToFetch.slice(i, i + maxIdsPerRequest);
      try {
        const prices = await fetchFromAPI<ItemPrice[]>('/commerce/prices', { ids: chunk });
        newPrices.push(...prices);
      } catch (error) {
        handleApiError(error, `fetchItemPrices chunk ${i}`);
      }
    }
  }
  
  // Cache the newly fetched prices
  if (newPrices.length > 0) {
    try {
      await cachePrices(newPrices);
    } catch (error) {
      console.error('Error caching prices:', error);
    }
  }
  
  // Combine cached and newly fetched prices
  const allPricesMap = new Map<number, ItemPrice>([
    ...Array.from(cachedPricesMap.entries()),
    ...newPrices.map(price => [price.id, price] as [number, ItemPrice])
  ]);
  
  // Create empty prices for missing items
  const result: ItemPrice[] = [];
  for (const id of ids) {
    const price = allPricesMap.get(id);
    if (price) {
      result.push(price);
    } else {
      // Create a properly typed empty price
      result.push({
        id,
        whitelisted: false,
        buys: { quantity: 0, unit_price: 0 },
        sells: { quantity: 0, unit_price: 0 }
      });
    }
  }
  
  return result;
}

/**
 * Форматувати ціну в монетах (золото/срібло/мідь)
 */
export function formatPrice(price: number): { gold: number, silver: number, copper: number } {
  const gold = Math.floor(price / 10000);
  const silver = Math.floor((price % 10000) / 100);
  const copper = price % 100;
  
  return { gold, silver, copper };
}

/**
 * Форматувати ціну в монетах з HTML-іконками
 */
export function formatPriceWithIcons(price: number): string {
  const { gold, silver, copper } = formatPrice(price);
  
  let result = '';
  
  if (gold > 0) {
    result += `${gold} <img src="/images/currency/gold.svg" alt="g" class="currency-icon" /> `;
  }
  
  if (silver > 0 || gold > 0) {
    result += `${silver} <img src="/images/currency/silver.svg" alt="s" class="currency-icon" /> `;
  }
  
  result += `${copper} <img src="/images/currency/copper.svg" alt="c" class="currency-icon" />`;
  
  return result;
}

/**
 * Get all recipe IDs using cache if available
 */
export async function getAllRecipeIds(): Promise<number[]> {
  // Try to get recipe IDs from cache first
  const shouldUpdate = await shouldUpdateCache('recipes', 24); // Update every 24 hours
  const cachedIds = await getAllCachedRecipeIds();
  
  // If we have cached recipe IDs and they're not too old, return them
  if (cachedIds.length > 0 && !shouldUpdate) {
    return cachedIds;
  }
  
  // Otherwise fetch from API
  try {
    const response = await fetch(`${API_BASE_URL}/recipes`);
    if (!response.ok) {
      console.warn(`Failed to fetch recipe IDs: ${response.status} ${response.statusText}`);
      
      // Return cached IDs as fallback if available
      if (cachedIds.length > 0) {
        return cachedIds;
      }
      
      // Otherwise generate some fallback IDs
      return Array.from({ length: 500 }, (_, i) => 1000 + i);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching recipe IDs:', error);
    
    // Return cached IDs as fallback if available
    if (cachedIds.length > 0) {
      return cachedIds;
    }
    
    // Otherwise return fallback IDs
    return Array.from({ length: 500 }, (_, i) => 1000 + i);
  }
}