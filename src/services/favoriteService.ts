// Ключ для збереження улюблених предметів в localStorage
const FAVORITES_KEY = 'gw2-favorites';

/**
 * Отримати список улюблених предметів
 */
export function getFavorites(): number[] {
  if (typeof window === 'undefined') {
    return [];
  }
  const stored = localStorage.getItem(FAVORITES_KEY);
  if (!stored) {
    return [];
  }
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to parse favorites from localStorage', error);
    return [];
  }
}

/**
 * Додати предмет до улюблених
 * @param itemId ID предмета для додавання
 */
export function addToFavorites(itemId: number): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  const favorites = getFavorites();
  if (!favorites.includes(itemId)) {
    favorites.push(itemId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }
}

/**
 * Видалити предмет з улюблених
 * @param itemId ID предмета для видалення
 */
export function removeFromFavorites(itemId: number): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  const favorites = getFavorites();
  const updatedFavorites = favorites.filter(id => id !== itemId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(updatedFavorites));
}

/**
 * Перевірити, чи є предмет в улюблених
 * @param itemId ID предмета для перевірки
 */
export function isFavorite(itemId: number): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  const favorites = getFavorites();
  return favorites.includes(itemId);
}

/**
 * Видалити всі улюблені предмети
 */
export function clearFavorites(): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.removeItem(FAVORITES_KEY);
} 