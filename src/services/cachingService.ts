import { Item, Recipe, ItemPrice } from "@/types/gw2api";

const DB_NAME = 'gw2_website_db';
const DB_VERSION = 1;
const ITEMS_STORE = 'items';
const RECIPES_STORE = 'recipes';
const PRICES_STORE = 'prices';
const METADATA_STORE = 'metadata';

// Відкриття бази даних
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', event);
      reject('Failed to open database');
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Створюємо сховища даних, якщо вони не існують
      if (!db.objectStoreNames.contains(ITEMS_STORE)) {
        db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(RECIPES_STORE)) {
        db.createObjectStore(RECIPES_STORE, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(PRICES_STORE)) {
        db.createObjectStore(PRICES_STORE, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
      }
    };
  });
};

// Зберегти предмети в кеш
export const cacheItems = async (items: Item[]): Promise<void> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([ITEMS_STORE, METADATA_STORE], 'readwrite');
    const store = transaction.objectStore(ITEMS_STORE);
    const metaStore = transaction.objectStore(METADATA_STORE);
    
    // Отримуємо поточну кількість елементів в тій же транзакції
    const countRequest = store.count();
    
    return new Promise((resolve, reject) => {
      countRequest.onsuccess = () => {
        const currentCount = countRequest.result;
        
        // Додаємо предмети у сховище
        items.forEach(item => {
          store.put(item);
        });
        
        // Оновлюємо метадані в тій самій транзакції
        metaStore.put({ 
          key: 'items_last_updated', 
          value: new Date().toISOString(),
          count: currentCount + items.length
        });
        
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        
        transaction.onerror = (event) => {
          console.error('Error caching items:', event);
          reject('Failed to cache items');
        };
      };
      
      countRequest.onerror = (event) => {
        console.error('Error counting items:', event);
        reject('Failed to count items');
      };
    });
  } catch (error) {
    console.error('Error in cacheItems:', error);
    throw error;
  }
};

// Зберегти рецепти в кеш
export const cacheRecipes = async (recipes: Recipe[]): Promise<void> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([RECIPES_STORE, METADATA_STORE], 'readwrite');
    const store = transaction.objectStore(RECIPES_STORE);
    const metaStore = transaction.objectStore(METADATA_STORE);
    
    // Отримуємо поточну кількість рецептів в тій же транзакції
    const countRequest = store.count();
    
    return new Promise((resolve, reject) => {
      countRequest.onsuccess = () => {
        const currentCount = countRequest.result;
        
        // Додаємо рецепти у сховище
        recipes.forEach(recipe => {
          store.put(recipe);
        });
        
        // Оновлюємо метадані в тій самій транзакції
        metaStore.put({ 
          key: 'recipes_last_updated', 
          value: new Date().toISOString(),
          count: currentCount + recipes.length
        });
        
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        
        transaction.onerror = (event) => {
          console.error('Error caching recipes:', event);
          reject('Failed to cache recipes');
        };
      };
      
      countRequest.onerror = (event) => {
        console.error('Error counting recipes:', event);
        reject('Failed to count recipes');
      };
    });
  } catch (error) {
    console.error('Error in cacheRecipes:', error);
    throw error;
  }
};

// Зберегти ціни в кеш
export const cachePrices = async (prices: ItemPrice[]): Promise<void> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([PRICES_STORE, METADATA_STORE], 'readwrite');
    const store = transaction.objectStore(PRICES_STORE);
    const metaStore = transaction.objectStore(METADATA_STORE);
    
    // Отримуємо поточну кількість цін в тій же транзакції
    const countRequest = store.count();
    
    return new Promise((resolve, reject) => {
      countRequest.onsuccess = () => {
        const currentCount = countRequest.result;
        
        // Додаємо ціни у сховище
        prices.forEach(price => {
          store.put(price);
        });
        
        // Оновлюємо метадані в тій самій транзакції
        metaStore.put({ 
          key: 'prices_last_updated', 
          value: new Date().toISOString(),
          count: currentCount + prices.length
        });
        
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        
        transaction.onerror = (event) => {
          console.error('Error caching prices:', event);
          reject('Failed to cache prices');
        };
      };
      
      countRequest.onerror = (event) => {
        console.error('Error counting prices:', event);
        reject('Failed to count prices');
      };
    });
  } catch (error) {
    console.error('Error in cachePrices:', error);
    throw error;
  }
};

// Отримати предмет з кешу
export const getCachedItem = async (id: number): Promise<Item | null> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(ITEMS_STORE, 'readonly');
    const store = transaction.objectStore(ITEMS_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      
      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };
      
      request.onerror = (event) => {
        console.error('Error getting cached item:', event);
        reject('Failed to get cached item');
      };
    });
  } catch (error) {
    console.error('Error in getCachedItem:', error);
    return null;
  }
};

// Отримати рецепт з кешу
export const getCachedRecipe = async (id: number): Promise<Recipe | null> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(RECIPES_STORE, 'readonly');
    const store = transaction.objectStore(RECIPES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      
      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };
      
      request.onerror = (event) => {
        console.error('Error getting cached recipe:', event);
        reject('Failed to get cached recipe');
      };
    });
  } catch (error) {
    console.error('Error in getCachedRecipe:', error);
    return null;
  }
};

// Отримати ціну з кешу
export const getCachedPrice = async (id: number): Promise<ItemPrice | null> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(PRICES_STORE, 'readonly');
    const store = transaction.objectStore(PRICES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      
      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };
      
      request.onerror = (event) => {
        console.error('Error getting cached price:', event);
        reject('Failed to get cached price');
      };
    });
  } catch (error) {
    console.error('Error in getCachedPrice:', error);
    return null;
  }
};

// Отримати кілька предметів з кешу
export const getCachedItems = async (ids: number[]): Promise<Item[]> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(ITEMS_STORE, 'readonly');
    const store = transaction.objectStore(ITEMS_STORE);
    const items: Item[] = [];
    
    return new Promise((resolve, reject) => {
      const processNext = (index: number) => {
        if (index >= ids.length) {
          db.close();
          resolve(items);
          return;
        }
        
        const request = store.get(ids[index]);
        
        request.onsuccess = () => {
          if (request.result) {
            items.push(request.result);
          }
          processNext(index + 1);
        };
        
        request.onerror = (event) => {
          console.error('Error getting cached items:', event);
          reject('Failed to get cached items');
        };
      };
      
      processNext(0);
    });
  } catch (error) {
    console.error('Error in getCachedItems:', error);
    return [];
  }
};

// Отримати кілька рецептів з кешу
export const getCachedRecipes = async (ids: number[]): Promise<Recipe[]> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(RECIPES_STORE, 'readonly');
    const store = transaction.objectStore(RECIPES_STORE);
    const recipes: Recipe[] = [];
    
    return new Promise((resolve, reject) => {
      const processNext = (index: number) => {
        if (index >= ids.length) {
          db.close();
          resolve(recipes);
          return;
        }
        
        const request = store.get(ids[index]);
        
        request.onsuccess = () => {
          if (request.result) {
            recipes.push(request.result);
          }
          processNext(index + 1);
        };
        
        request.onerror = (event) => {
          console.error('Error getting cached recipes:', event);
          reject('Failed to get cached recipes');
        };
      };
      
      processNext(0);
    });
  } catch (error) {
    console.error('Error in getCachedRecipes:', error);
    return [];
  }
};

// Отримати кілька цін з кешу
export const getCachedPrices = async (ids: number[]): Promise<ItemPrice[]> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(PRICES_STORE, 'readonly');
    const store = transaction.objectStore(PRICES_STORE);
    const prices: ItemPrice[] = [];
    
    return new Promise((resolve, reject) => {
      const processNext = (index: number) => {
        if (index >= ids.length) {
          db.close();
          resolve(prices);
          return;
        }
        
        const request = store.get(ids[index]);
        
        request.onsuccess = () => {
          if (request.result) {
            prices.push(request.result);
          }
          processNext(index + 1);
        };
        
        request.onerror = (event) => {
          console.error('Error getting cached prices:', event);
          reject('Failed to get cached prices');
        };
      };
      
      processNext(0);
    });
  } catch (error) {
    console.error('Error in getCachedPrices:', error);
    return [];
  }
};

// Отримати всі предмети з кешу
export const getAllCachedItems = async (): Promise<Item[]> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(ITEMS_STORE, 'readonly');
    const store = transaction.objectStore(ITEMS_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };
      
      request.onerror = (event) => {
        console.error('Error getting all cached items:', event);
        reject('Failed to get all cached items');
      };
    });
  } catch (error) {
    console.error('Error in getAllCachedItems:', error);
    return [];
  }
};

// Отримати всі рецепти з кешу
export const getAllCachedRecipes = async (): Promise<Recipe[]> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(RECIPES_STORE, 'readonly');
    const store = transaction.objectStore(RECIPES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };
      
      request.onerror = (event) => {
        console.error('Error getting all cached recipes:', event);
        reject('Failed to get all cached recipes');
      };
    });
  } catch (error) {
    console.error('Error in getAllCachedRecipes:', error);
    return [];
  }
};

// Отримати ID всіх рецептів з кешу
export const getAllCachedRecipeIds = async (): Promise<number[]> => {
  try {
    const recipes = await getAllCachedRecipes();
    return recipes.map(recipe => recipe.id);
  } catch (error) {
    console.error('Error in getAllCachedRecipeIds:', error);
    return [];
  }
};

// Отримати всі ціни з кешу
export const getAllCachedPrices = async (): Promise<ItemPrice[]> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(PRICES_STORE, 'readonly');
    const store = transaction.objectStore(PRICES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };
      
      request.onerror = (event) => {
        console.error('Error getting all cached prices:', event);
        reject('Failed to get all cached prices');
      };
    });
  } catch (error) {
    console.error('Error in getAllCachedPrices:', error);
    return [];
  }
};

// Очистити кеш
export const clearCache = async (storeName?: string): Promise<void> => {
  try {
    const db = await openDatabase();
    
    if (storeName) {
      // Очистити конкретне сховище
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.clear();
        
        request.onsuccess = () => {
          db.close();
          resolve();
        };
        
        request.onerror = (event) => {
          console.error(`Error clearing ${storeName} cache:`, event);
          reject(`Failed to clear ${storeName} cache`);
        };
      });
    } else {
      // Очистити всі сховища
      const itemsTransaction = db.transaction(ITEMS_STORE, 'readwrite');
      const recipesTransaction = db.transaction(RECIPES_STORE, 'readwrite');
      const pricesTransaction = db.transaction(PRICES_STORE, 'readwrite');
      
      itemsTransaction.objectStore(ITEMS_STORE).clear();
      recipesTransaction.objectStore(RECIPES_STORE).clear();
      pricesTransaction.objectStore(PRICES_STORE).clear();
      
      return new Promise((resolve) => {
        setTimeout(() => {
          db.close();
          resolve();
        }, 100);
      });
    }
  } catch (error) {
    console.error('Error in clearCache:', error);
    throw error;
  }
};

// Отримати метадані кешу
export const getCacheMetadata = async (): Promise<any> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(METADATA_STORE, 'readonly');
    const store = transaction.objectStore(METADATA_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const result = request.result || [];
        const metadata: Record<string, any> = {};
        
        result.forEach(item => {
          metadata[item.key] = item;
        });
        
        db.close();
        resolve(metadata);
      };
      
      request.onerror = (event) => {
        console.error('Error getting cache metadata:', event);
        reject('Failed to get cache metadata');
      };
    });
  } catch (error) {
    console.error('Error in getCacheMetadata:', error);
    return {};
  }
};

// Перевірити, чи потрібно оновлювати кеш
export const shouldUpdateCache = async (cacheType: string, maxAgeHours: number = 24): Promise<boolean> => {
  try {
    const metadata = await getCacheMetadata();
    const lastUpdatedKey = `${cacheType}_last_updated`;
    
    if (!metadata[lastUpdatedKey]) {
      return true;
    }
    
    const lastUpdated = new Date(metadata[lastUpdatedKey].value);
    const now = new Date();
    const diffHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
    
    return diffHours > maxAgeHours;
  } catch (error) {
    console.error('Error in shouldUpdateCache:', error);
    return true;
  }
};

// Отримати статистику кешу
export const getCacheStats = async (): Promise<{
  items: number;
  recipes: number;
  prices: number;
  lastUpdated: {
    items: string | null;
    recipes: string | null;
    prices: string | null;
  }
}> => {
  try {
    const metadata = await getCacheMetadata();
    
    return {
      items: metadata['items_last_updated']?.count || await getItemsCount(),
      recipes: metadata['recipes_last_updated']?.count || await getRecipesCount(),
      prices: metadata['prices_last_updated']?.count || await getPricesCount(),
      lastUpdated: {
        items: metadata['items_last_updated']?.value || null,
        recipes: metadata['recipes_last_updated']?.value || null,
        prices: metadata['prices_last_updated']?.value || null,
      }
    };
  } catch (error) {
    console.error('Error in getCacheStats:', error);
    return {
      items: 0,
      recipes: 0,
      prices: 0,
      lastUpdated: {
        items: null,
        recipes: null,
        prices: null,
      }
    };
  }
};

// Допоміжні функції для отримання кількості записів
async function getItemsCount(): Promise<number> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(ITEMS_STORE, 'readonly');
    const store = transaction.objectStore(ITEMS_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.count();
      
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        console.error('Error counting items:', event);
        reject('Failed to count items');
      };
    });
  } catch (error) {
    console.error('Error in getItemsCount:', error);
    return 0;
  }
}

async function getRecipesCount(): Promise<number> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(RECIPES_STORE, 'readonly');
    const store = transaction.objectStore(RECIPES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.count();
      
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        console.error('Error counting recipes:', event);
        reject('Failed to count recipes');
      };
    });
  } catch (error) {
    console.error('Error in getRecipesCount:', error);
    return 0;
  }
}

async function getPricesCount(): Promise<number> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(PRICES_STORE, 'readonly');
    const store = transaction.objectStore(PRICES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.count();
      
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        console.error('Error counting prices:', event);
        reject('Failed to count prices');
      };
    });
  } catch (error) {
    console.error('Error in getPricesCount:', error);
    return 0;
  }
} 