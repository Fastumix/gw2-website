// Main Item interface
export interface Item {
    id: number;
    chat_link: string;
    name: string;
    icon?: string;
    description?: string;
    type: ItemType;
    rarity: ItemRarity;
    level: number;
    vendor_value: number;
    default_skin?: number;
    flags: ItemFlag[];
    game_types: GameType[];
    restrictions: ItemRestriction[];
    upgrades_into?: ItemUpgrade[];
    upgrades_from?: ItemUpgrade[];
    details?: ItemDetails;
  }
  
// Інтерфейс для цін у торговому пості
export interface ItemPrice {
  id: number;
  whitelisted: boolean;
  buys: {
    quantity: number;
    unit_price: number;
  };
  sells: {
    quantity: number;
    unit_price: number;
  };
}
  
  // Enum types
  export type ItemType = 
    'Armor' | 'Back' | 'Bag' | 'Consumable' | 'Container' | 
    'CraftingMaterial' | 'Gathering' | 'Gizmo' | 'JadeTechModule' | 
    'Key' | 'MiniPet' | 'PowerCore' | 'Relic' | 'Tool' | 
    'Trait' | 'Trinket' | 'Trophy' | 'UpgradeComponent' | 'Weapon';
  
  export type ItemRarity = 
    'Junk' | 'Basic' | 'Fine' | 'Masterwork' | 
    'Rare' | 'Exotic' | 'Ascended' | 'Legendary';
  
  export type ItemFlag = 
    'AccountBindOnUse' | 'AccountBound' | 'Attuned' | 'BulkConsume' | 
    'DeleteWarning' | 'HideSuffix' | 'Infused' | 'MonsterOnly' | 
    'NoMysticForge' | 'NoSalvage' | 'NoSell' | 'NotUpgradeable' | 
    'NoUnderwater' | 'SoulbindOnAcquire' | 'SoulBindOnUse' | 'Tonic' | 'Unique';
  
  export type GameType = 
    'Activity' | 'Dungeon' | 'Pve' | 'Pvp' | 'PvpLobby' | 'Wvw';
  
  export type ItemRestriction = 
    'Asura' | 'Charr' | 'Female' | 'Human' | 'Norn' | 'Revenant' | 
    'Sylvari' | 'Elementalist' | 'Engineer' | 'Guardian' | 'Mesmer' | 
    'Necromancer' | 'Ranger' | 'Thief' | 'Warrior';
  
  // Item upgrade structure
  export interface ItemUpgrade {
    upgrade: 'Attunement' | 'Infusion';
    item_id: number;
  }
  
  // Infix Upgrade subobject
  export interface InfixUpgrade {
    id: number;
    attributes: {
      attribute: 'AgonyResistance' | 'BoonDuration' | 'ConditionDamage' | 
                 'ConditionDuration' | 'CritDamage' | 'Healing' | 
                 'Power' | 'Precision' | 'Toughness' | 'Vitality';
      modifier: number;
    }[];
    buff?: {
      skill_id: number;
      description?: string;
    };
  }
  
  // Infusion slot subobject
  export interface InfusionSlot {
    flags: ('Enrichment' | 'Infusion')[];
    item_id?: number;
  }
  
  // Union type for all possible item details
  export type ItemDetails = 
    ArmorDetails | BackItemDetails | BagDetails | ConsumableDetails | 
    ContainerDetails | GatheringDetails | GizmoDetails | MiniPetDetails | 
    SalvageKitDetails | TrinketDetails | UpgradeComponentDetails | WeaponDetails;
  
  // Type-specific details
  export interface ArmorDetails {
    type: 'Boots' | 'Coat' | 'Gloves' | 'Helm' | 'HelmAquatic' | 'Leggings' | 'Shoulders';
    weight_class: 'Heavy' | 'Medium' | 'Light' | 'Clothing';
    defense: number;
    infusion_slots: InfusionSlot[];
    attribute_adjustment: number;
    infix_upgrade?: InfixUpgrade;
    suffix_item_id?: number;
    secondary_suffix_item_id: string;
    stat_choices?: number[];
  }
  
  export interface BackItemDetails {
    infusion_slots: InfusionSlot[];
    attribute_adjustment: number;
    infix_upgrade?: InfixUpgrade;
    suffix_item_id?: number;
    secondary_suffix_item_id: string;
    stat_choices?: number[];
  }
  
  export interface BagDetails {
    size: number;
    no_sell_or_sort: boolean;
  }
  
  export interface ConsumableDetails {
    type: 'AppearanceChange' | 'Booze' | 'ContractNpc' | 'Currency' | 'Food' | 
          'Generic' | 'Halloween' | 'Immediate' | 'MountRandomUnlock' | 
          'RandomUnlock' | 'Transmutation' | 'Unlock' | 'UpgradeRemoval' | 
          'Utility' | 'TeleportToFriend';
    description?: string;
    duration_ms?: number;
    unlock_type?: 'BagSlot' | 'BankTab' | 'BuildLibrarySlot' | 'BuildLoadoutTab' | 
                  'Champion' | 'CollectibleCapacity' | 'Content' | 'CraftingRecipe' | 
                  'Dye' | 'GearLoadoutTab' | 'GliderSkin' | 'JadeBotSkin' | 
                  'Minipet' | 'Ms' | 'Outfit' | 'RandomUlock' | 'SharedSlot';
    color_id?: number;
    recipe_id?: number;
    extra_recipe_ids?: number[];
    guild_upgrade_id?: number;
    apply_count?: number;
    name?: string;
    icon?: string;
    skins?: number[];
  }
  
  export interface ContainerDetails {
    type: 'Default' | 'GiftBox' | 'Immediate' | 'OpenUI';
  }
  
  export interface GatheringDetails {
    type: 'Foraging' | 'Logging' | 'Mining' | 'Bait' | 'Lure';
  }
  
  export interface GizmoDetails {
    type: 'Default' | 'ContainerKey' | 'RentableContractNpc' | 'UnlimitedConsumable';
    guild_upgrade_id?: number;
    vendor_ids?: number[];
  }
  
  export interface MiniPetDetails {
    minipet_id: number;
  }
  
  export interface SalvageKitDetails {
    type: 'Salvage';
    charges: number;
  }
  
  export interface TrinketDetails {
    type: 'Accessory' | 'Amulet' | 'Ring';
    infusion_slots: InfusionSlot[];
    attribute_adjustment: number;
    infix_upgrade?: InfixUpgrade;
    suffix_item_id?: number;
    secondary_suffix_item_id: string;
    stat_choices?: number[];
  }
  
  export interface UpgradeComponentDetails {
    type: 'Default' | 'Gem' | 'Rune' | 'Sigil';
    flags: ('Axe' | 'Dagger' | 'Focus' | 'Greatsword' | 'Hammer' | 'Harpoon' | 
           'LongBow' | 'Mace' | 'Pistol' | 'Rifle' | 'Scepter' | 'Shield' | 
           'ShortBow' | 'Speargun' | 'Staff' | 'Sword' | 'Torch' | 'Trident' | 
           'Warhorn' | 'HeavyArmor' | 'MediumArmor' | 'LightArmor' | 'Trinket')[];
    infusion_upgrade_flags: ('Enrichment' | 'Infusion')[];
    suffix: string;
    infix_upgrade: InfixUpgrade;
    bonuses?: string[];
  }
  
  export interface WeaponDetails {
    type: 'Axe' | 'Dagger' | 'Mace' | 'Pistol' | 'Scepter' | 'Sword' | 
          'Focus' | 'Shield' | 'Torch' | 'Warhorn' | 'Greatsword' | 'Hammer' | 
          'LongBow' | 'Rifle' | 'ShortBow' | 'Staff' | 'Harpoon' | 'Speargun' | 
          'Trident' | 'LargeBundle' | 'SmallBundle' | 'Toy' | 'ToyTwoHanded';
    damage_type: 'Fire' | 'Ice' | 'Lightning' | 'Physical' | 'Choking';
    min_power: number;
    max_power: number;
    defense: number;
    infusion_slots: InfusionSlot[];
    attribute_adjustment: number;
    infix_upgrade?: InfixUpgrade;
    suffix_item_id?: number;
    secondary_suffix_item_id: string;
    stat_choices?: number[];
  }

// Recipe interfaces
export interface Recipe {
  id: number;
  type: string;
  output_item_id: number;
  output_item_count: number;
  time_to_craft_ms: number;
  disciplines: CraftingDiscipline[];
  min_rating: number;
  flags: RecipeFlag[];
  ingredients: RecipeIngredient[];
  chat_link: string;
}

export type CraftingDiscipline = 
  'Armorsmith' | 'Artificer' | 'Chef' | 'Huntsman' | 
  'Jeweler' | 'Leatherworker' | 'Tailor' | 'Weaponsmith' | 'Scribe';

export type RecipeFlag = 'AutoLearned' | 'LearnedFromItem';

export interface RecipeIngredient {
  item_id: number;
  count: number;
}

// Character interface
export interface Character {
  name: string;
  race: string;
  profession: string;
  level: number;
  guild?: string;
  created: string;
  age: number;
  deaths: number;
  // Other properties can be added as needed
}