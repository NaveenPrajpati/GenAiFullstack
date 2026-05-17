export type IngredientCategory =
  | 'Vegetables'
  | 'Fruits'
  | 'Dairy'
  | 'Proteins (Veg)'
  | 'Proteins (Non-Veg)'
  | 'Grains'
  | 'Spices'
  | 'Sauces';

export const INGREDIENTS: Record<IngredientCategory, string[]> = {
  Vegetables: [
    'Tomato', 'Potato', 'Onion', 'Garlic', 'Ginger', 'Spinach', 'Carrot',
    'Capsicum', 'Cauliflower', 'Green Beans', 'Peas', 'Mushrooms', 'Broccoli',
    'Sweet Corn', 'Beetroot', 'Cabbage', 'Zucchini', 'Eggplant', 'Celery', 'Leek',
  ],
  Fruits: [
    'Lemon', 'Lime', 'Mango', 'Coconut', 'Banana', 'Apple', 'Pineapple',
    'Tamarind', 'Avocado', 'Orange', 'Pomegranate', 'Papaya',
  ],
  Dairy: ['Milk', 'Yogurt', 'Butter', 'Cheese', 'Paneer', 'Cream', 'Ghee', 'Condensed Milk'],
  'Proteins (Veg)': [
    'Chickpeas', 'Red Lentils', 'Black Lentils', 'Kidney Beans', 'Black Beans',
    'Tofu', 'Tempeh', 'Edamame', 'Split Peas', 'Moong Dal',
  ],
  'Proteins (Non-Veg)': ['Chicken', 'Mutton', 'Beef', 'Pork', 'Fish', 'Shrimp', 'Eggs', 'Bacon', 'Turkey', 'Duck'],
  Grains: ['Rice', 'Wheat Flour', 'Pasta', 'Bread', 'Quinoa', 'Oats', 'Cornmeal', 'Semolina', 'Noodles', 'Barley'],
  Spices: [
    'Salt', 'Black Pepper', 'Cumin', 'Coriander', 'Turmeric', 'Red Chili Powder',
    'Garam Masala', 'Oregano', 'Basil', 'Thyme', 'Paprika', 'Cardamom',
    'Cinnamon', 'Cloves', 'Bay Leaves', 'Mustard Seeds',
  ],
  Sauces: [
    'Tomato Sauce', 'Soy Sauce', 'Hot Sauce', 'Vinegar', 'Olive Oil',
    'Sesame Oil', 'Worcestershire Sauce', 'Fish Sauce', 'Coconut Milk', 'Oyster Sauce',
  ],
};

export const isNonVeg = (category: IngredientCategory) => category === 'Proteins (Non-Veg)';

export const CATEGORY_EMOJIS: Record<IngredientCategory, string> = {
  Vegetables: '🥬',
  Fruits: '🍋',
  Dairy: '🧀',
  'Proteins (Veg)': '🫘',
  'Proteins (Non-Veg)': '🍗',
  Grains: '🍚',
  Spices: '🌶️',
  Sauces: '🫙',
};
