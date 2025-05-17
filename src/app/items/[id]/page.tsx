'use client';

import React, { useState, useEffect } from 'react';
import { fetchItem, searchRecipesByOutput, fetchRecipe, fetchItems, fetchItemPrice, fetchItemPrices, formatPrice, formatPriceWithIcons } from '@/services/gw2api';
import { addToFavorites, removeFromFavorites, isFavorite } from '@/services/favoriteService';
import { Item, Recipe, ItemPrice } from '@/types/gw2api';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import './item-details.css';

interface RecipeData {
  recipe: Recipe;
  ingredients: Item[];
}

export default function ItemDetailPage({ params }: { params: { id: string } }) {
  // Використовуємо React.use() для отримання params
  const resolvedParams = React.use(params as any) as { id: string };
  const itemId = resolvedParams.id;

  const [item, setItem] = useState<Item | null>(null);
  const [recipes, setRecipes] = useState<RecipeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [similarItems, setSimilarItems] = useState<Item[]>([]);
  const [craftCost, setCraftCost] = useState<number | null>(null);
  const [sourceInfo, setSourceInfo] = useState<string>('');
  const [itemPrice, setItemPrice] = useState<ItemPrice | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [ingredientDetails, setIngredientDetails] = useState<Record<number, { source: string, price: ItemPrice | null }>>({});
  const searchParams = useSearchParams();
  const compareItemId = searchParams.get('compare');

  useEffect(() => {
    async function loadItemData() {
      try {
        setLoading(true);
        setLoadingPrice(true);
        
        // Використовуємо itemId замість params.id
        const itemData = await fetchItem(parseInt(itemId));
        setItem(itemData);
        
        // Check if item is in favorites
        setIsFav(isFavorite(itemData.id));
        
        // Load recipes
        const recipeIds = await searchRecipesByOutput(itemData.id);
        
        if (recipeIds.length > 0) {
          const recipesData: RecipeData[] = [];
          const ingredientDetailsTemp: Record<number, { source: string, price: ItemPrice | null }> = {};
          
          for (const recipeId of recipeIds) {
            const recipe = await fetchRecipe(recipeId);
            
            // Load ingredient information
            const ingredientIds = recipe.ingredients.map(ing => ing.item_id);
            const ingredientItems = await fetchItems(ingredientIds);
            
            // Отримуємо ціни для всіх інгредієнтів
            const ingredientPrices = await fetchItemPrices(ingredientIds);
            
            // Додаємо інформацію про джерела отримання для кожного інгредієнта
            for (const ingredient of ingredientItems) {
              if (!ingredientDetailsTemp[ingredient.id]) {
                // Визначаємо джерело отримання інгредієнта
                let source = '';
                
                if (ingredient.flags.includes('AccountBound')) {
                  source = 'Account Bound - Reward from achievements or events';
                } else if (ingredient.type === 'CraftingMaterial') {
                  if (ingredient.name.toLowerCase().includes('ore') || 
                      ingredient.name.toLowerCase().includes('ingot')) {
                    source = 'Mining nodes, salvaging metal gear, or Trading Post';
                  } else if (ingredient.name.toLowerCase().includes('wood') || 
                             ingredient.name.toLowerCase().includes('plank') || 
                             ingredient.name.toLowerCase().includes('log')) {
                    source = 'Chopping trees, salvaging wooden gear, or Trading Post';
                  } else if (ingredient.name.toLowerCase().includes('leather') || 
                             ingredient.name.toLowerCase().includes('hide')) {
                    source = 'Salvaging leather gear, or Trading Post';
                  } else if (ingredient.name.toLowerCase().includes('cloth') || 
                             ingredient.name.toLowerCase().includes('silk') || 
                             ingredient.name.toLowerCase().includes('wool')) {
                    source = 'Salvaging cloth gear, or Trading Post';
                  } else if (ingredient.name.toLowerCase().includes('dust') ||
                             ingredient.name.toLowerCase().includes('essence')) {
                    source = 'Salvaging gear, or Trading Post';
                  } else {
                    source = 'Gathering, monster drops, or Trading Post';
                  }
                } else if (ingredient.type === 'Trophy') {
                  source = 'Dropped from creatures, reward from events or Trading Post';
                } else if (ingredient.type === 'Consumable') {
                  source = 'Merchants, crafting or Trading Post';
                } else if (ingredient.type === 'Weapon' || ingredient.type === 'Armor') {
                  source = 'Crafting, dungeon rewards, or Trading Post';
                } else {
                  source = 'Trading Post or in-game activities';
                }
                
                // Знаходимо ціну для цього інгредієнта
                const price = ingredientPrices.find((p: ItemPrice) => p.id === ingredient.id) || null;
                
                ingredientDetailsTemp[ingredient.id] = { source, price };
              }
            }
            
            recipesData.push({ recipe, ingredients: ingredientItems });
          }
          
          setRecipes(recipesData);
          setIngredientDetails(ingredientDetailsTemp);
          
          // Calculate crafting cost (using first recipe)
          if (recipesData.length > 0) {
            let totalCost = 0;
            
            // Використовуємо ціну з Trading Post, якщо доступна, інакше vendor_value
            for (const ingredient of recipesData[0].ingredients) {
              const recipeIngredient = recipesData[0].recipe.ingredients.find(
                ing => ing.item_id === ingredient.id
              );
              const count = recipeIngredient?.count || 1;
              
              // Перевіряємо чи є ціна з Trading Post
              const tpPrice = ingredientDetailsTemp[ingredient.id]?.price;
              
              if (tpPrice && tpPrice.sells.unit_price > 0) {
                // Використовуємо ціни продажу з Trading Post
                totalCost += tpPrice.sells.unit_price * count;
              } else {
                // Використовуємо vendor_value, якщо немає ціни з Trading Post
                totalCost += ingredient.vendor_value * count;
              }
            }
            
            setCraftCost(totalCost);
          }

          // Set source information for crafting
          setSourceInfo('Crafting');
        } else {
          // Determine item source based on item type and flags
          if (itemData.flags.includes('AccountBound')) {
            setSourceInfo('Account Bound - Reward from achievements or events');
          } else if (itemData.type === 'CraftingMaterial') {
            if (itemData.name.toLowerCase().includes('ore') || 
                itemData.name.toLowerCase().includes('ingot')) {
              setSourceInfo('Mining nodes, salvaging metal gear, or Trading Post');
            } else if (itemData.name.toLowerCase().includes('wood') || 
                       itemData.name.toLowerCase().includes('plank') || 
                       itemData.name.toLowerCase().includes('log')) {
              setSourceInfo('Chopping trees, salvaging wooden gear, or Trading Post');
            } else if (itemData.name.toLowerCase().includes('leather') || 
                       itemData.name.toLowerCase().includes('hide')) {
              setSourceInfo('Salvaging leather gear, or Trading Post');
            } else if (itemData.name.toLowerCase().includes('cloth') || 
                       itemData.name.toLowerCase().includes('silk') || 
                       itemData.name.toLowerCase().includes('wool')) {
              setSourceInfo('Salvaging cloth gear, or Trading Post');
            } else if (itemData.name.toLowerCase().includes('dust') ||
                       itemData.name.toLowerCase().includes('essence')) {
              setSourceInfo('Salvaging gear, or Trading Post');
            } else {
              setSourceInfo('Gathering, monster drops, or Trading Post');
            }
          } else if (itemData.type === 'Consumable') {
            setSourceInfo('Merchants or Trading Post');
          } else if (itemData.rarity === 'Legendary') {
            setSourceInfo('Legendary crafting or achievements');
          } else if (itemData.rarity === 'Exotic' || itemData.rarity === 'Ascended') {
            setSourceInfo('Crafting, dungeons or world bosses');
          } else {
            setSourceInfo('Trading Post, merchants or drops');
          }
        }
        
        // Отримуємо ціни з торгового поста
        try {
          const priceData = await fetchItemPrice(itemData.id);
          setItemPrice(priceData);
        } catch (priceError) {
          console.error('Failed to load item price:', priceError);
        } finally {
          setLoadingPrice(false);
        }
        
        // Load similar items (of same type and rarity)
        const similarItemIds = [
          // Simple example for demonstration - can be expanded in the future
          itemData.id + 1, 
          itemData.id + 2, 
          itemData.id + 3, 
          itemData.id + 4
        ];
        
        const similarItemsData = await fetchItems(similarItemIds);
        setSimilarItems(
          similarItemsData.filter(similar => 
            similar.type === itemData.type && 
            similar.rarity === itemData.rarity
          )
        );
      } catch (err) {
        console.error('Failed to load item details:', err);
        setError(`Failed to load item details: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }
    
    loadItemData();
  }, [itemId]); // Використовуємо itemId замість params.id
  
  // Function to add/remove an item from favorites
  const toggleFavorite = () => {
    if (!item) return;
    
    if (isFav) {
      removeFromFavorites(item.id);
    } else {
      addToFavorites(item.id);
    }
    
    setIsFav(!isFav);
  };
  
  // Візуалізуємо частину з рецептами
  const renderRecipeSection = () => {
    if (recipes.length === 0) return null;
    
    return (
      <div className="item-detail-section">
        <h2 className="section-title">Crafting</h2>
        {recipes.map((recipeData, index) => (
          <div key={recipeData.recipe.id} className="recipe-container">
            <h3>Recipe {recipes.length > 1 ? `#${index + 1}` : ''}</h3>
            <div className="recipe-details">
              <div>
                <span className="info-label">Disciplines:</span> {recipeData.recipe.disciplines.join(', ')}
              </div>
              <div>
                <span className="info-label">Min Rating:</span> {recipeData.recipe.min_rating}
              </div>
              {craftCost !== null && (
                <div>
                  <span className="info-label">Crafting Cost:</span> <span dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(craftCost) }} />
                  {itemPrice && itemPrice.sells.unit_price > 0 && craftCost < itemPrice.sells.unit_price && (
                    <span className="craft-profit">
                      (Profit: <span dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(itemPrice.sells.unit_price - craftCost) }} />)
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <div className="ingredients-list">
              <h4>Ingredients:</h4>
              <div className="ingredients-grid">
                {recipeData.ingredients.map(ingredient => {
                  const count = recipeData.recipe.ingredients.find(
                    ing => ing.item_id === ingredient.id
                  )?.count || 1;
                  
                  const ingredientRarityClass = `text-${ingredient.rarity.toLowerCase()}`;
                  const details = ingredientDetails[ingredient.id];
                  
                  return (
                    <div key={ingredient.id} className="ingredient-detail-item">
                      <Link
                        href={`/items/${ingredient.id}`}
                        className="ingredient-item-header"
                      >
                        {ingredient.icon && (
                          <Image
                            src={ingredient.icon}
                            alt={ingredient.name}
                            width={40}
                            height={40}
                            className="ingredient-image"
                          />
                        )}
                        <div className="ingredient-info">
                          <span className={`ingredient-name ${ingredientRarityClass}`}>
                            {ingredient.name}
                          </span>
                          <span className="ingredient-count">x{count}</span>
                        </div>
                      </Link>
                      
                      {details && (
                        <div className="ingredient-extra-info">
                          <div className="ingredient-source">
                            <span className="info-label-sm">Source:</span> {details.source}
                          </div>
                          
                          {details.price && (
                            <div className="ingredient-tp-price">
                              <span className="info-label-sm">Price:</span>
                              {details.price.sells.unit_price > 0 ? (
                                <span>
                                  <span dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(details.price.sells.unit_price) }} /> per unit
                                  <span className="ingredient-total-price">
                                    (Total: <span dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(details.price.sells.unit_price * count) }} />)
                                  </span>
                                </span>
                              ) : (
                                <span>Not available on Trading Post</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="detail-loading">
        <div className="detail-spinner"></div>
        <p>Loading item information...</p>
      </div>
    );
  }
  
  if (error || !item) {
    return (
      <div className="detail-error">
        <h2>Error</h2>
        <p>{error || 'Item not found'}</p>
        <Link href="/" className="back-link">Return to Home</Link>
      </div>
    );
  }
  
  // Generate classes based on rarity
  const rarityClass = `rarity-${item.rarity.toLowerCase()}`;
  const textClass = `text-${item.rarity.toLowerCase()}`;
  const bgClass = `bg-${item.rarity.toLowerCase()}`;
  
  return (
    <div className="item-detail-container">
      <div className="item-detail-header">
        <Link href="/" className="back-button">← Back</Link>
        <h1 className={`item-detail-title ${textClass}`}>{item.name}</h1>
        
        {/* If accessed with compare parameter, show comparison button */}
        {compareItemId ? (
          <Link 
            href={`/compare?item1=${compareItemId}&item2=${item.id}`}
            className="compare-select-button"
          >
            Compare with selected
          </Link>
        ) : (
          <button 
            className={`detail-favorite-button ${isFav ? 'favorite-active' : ''}`}
            onClick={toggleFavorite}
          >
            {isFav ? 'Remove from favorites' : 'Add to favorites'}
          </button>
        )}
      </div>
      
      <div className="item-detail-content">
        <div className="item-detail-main">
          <div className="item-detail-image-container">
            {item.icon && (
              <Image
                src={item.icon}
                alt={item.name}
                width={128}
                height={128}
                className={`item-detail-image ${rarityClass}`}
              />
            )}
            <div className={`item-detail-rarity ${bgClass}`}>{item.rarity}</div>
          </div>
          
          <div className="item-detail-info">
            <div className="item-detail-category">
              <span className="info-label">Type:</span> {item.type}
            </div>
            
            <div className="item-detail-level">
              <span className="info-label">Level:</span> {item.level}
            </div>
            
            <div className="item-detail-value">
              <span className="info-label">Value:</span> <span dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(item.vendor_value) }} />
            </div>

            <div className="item-detail-source">
              <span className="info-label">Source:</span> {sourceInfo}
            </div>
            
            {/* Секція з цінами торгового поста */}
            {loadingPrice ? (
              <div className="item-detail-tp-loading">
                <span className="info-label">Trading Post:</span> Loading prices...
              </div>
            ) : itemPrice && (itemPrice.buys.unit_price > 0 || itemPrice.sells.unit_price > 0) ? (
              <div className="item-detail-tp">
                <h3>Trading Post Prices:</h3>
                <div className="item-detail-prices">
                  {itemPrice.buys.unit_price > 0 && (
                    <div className="item-detail-price buy">
                      <span className="info-label buy-price">Buy orders:</span> 
                      <span className="price-value">
                        <span dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(itemPrice.buys.unit_price) }} />
                      </span>
                      <span className="price-quantity">({itemPrice.buys.quantity} available)</span>
                    </div>
                  )}
                  
                  {itemPrice.sells.unit_price > 0 && (
                    <div className="item-detail-price sell">
                      <span className="info-label sell-price">Sell listings:</span> 
                      <span className="price-value">
                        <span dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(itemPrice.sells.unit_price) }} />
                      </span>
                      <span className="price-quantity">({itemPrice.sells.quantity} available)</span>
                    </div>
                  )}
                  
                  {itemPrice.buys.unit_price > 0 && itemPrice.sells.unit_price > 0 && (
                    <div className="item-detail-price-diff">
                      <span className="info-label">Profit from flip:</span> 
                      <span className="price-value">
                        <span dangerouslySetInnerHTML={{ __html: formatPriceWithIcons(itemPrice.sells.unit_price - itemPrice.buys.unit_price) }} />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="item-detail-no-tp">
                <span className="info-label">Trading Post:</span> Not available for trading
              </div>
            )}
            
            {item.description && (
              <div className="item-detail-description">
                <h3>Description:</h3>
                <p>{item.description}</p>
              </div>
            )}
            
            {item.flags && item.flags.length > 0 && (
              <div className="item-detail-flags">
                <h3>Properties:</h3>
                <ul>
                  {item.flags.map(flag => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        
        {/* Crafting section */}
        {renderRecipeSection()}
        
        {/* Similar items */}
        {similarItems.length > 0 && (
          <div className="item-detail-section">
            <h2 className="section-title">Similar Items</h2>
            <div className="similar-items-grid">
              {similarItems.map(similar => {
                const similarRarityClass = `rarity-${similar.rarity.toLowerCase()}`;
                const similarTextClass = `text-${similar.rarity.toLowerCase()}`;
                
                return (
                  <Link
                    href={`/items/${similar.id}`}
                    key={similar.id}
                    className={`similar-item ${similarRarityClass}`}
                  >
                    {similar.icon && (
                      <Image
                        src={similar.icon}
                        alt={similar.name}
                        width={40}
                        height={40}
                        className="similar-item-image"
                      />
                    )}
                    <span className={`similar-item-name ${similarTextClass}`}>
                      {similar.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Item comparison */}
        <div className="item-detail-section">
          <h2 className="section-title">Item Comparison</h2>
          <p>Select another item from our catalog to compare:</p>
          <Link href={`/compare?item1=${item.id}`} className="compare-button">
            Select item for comparison
          </Link>
        </div>
      </div>
    </div>
  );
} 