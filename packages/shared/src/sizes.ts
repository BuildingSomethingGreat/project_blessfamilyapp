export const CLOTHING_CATEGORIES = ['Baby / Infant', 'Toddler', 'Youth / Kids', "Women's", "Men's"] as const;
export type ClothingCategory = (typeof CLOTHING_CATEGORIES)[number];

export const CLOTHING_SIZES: Record<ClothingCategory, string[]> = {
  'Baby / Infant': ['Newborn', '0–3 Months', '3–6 Months', '6–9 Months', '9–12 Months', '12–18 Months', '18–24 Months'],
  Toddler: ['2T', '3T', '4T', '5T'],
  'Youth / Kids': ['4', '5', '6', '7', '8', '10', '12', '14', '16', '18', '20', 'XS', 'S', 'M', 'L', 'XL'],
  "Women's": ['XS', 'S', 'M', 'L', 'XL', '1X', '2X', '3X', '4X', '0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22', '24'],
  "Men's": ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '28', '30', '32', '34', '36', '38', '40', '42', '44'],
};

export const SHOE_SIZES: Record<ClothingCategory, string[]> = {
  'Baby / Infant': ['0', '1', '2', '3', '4'],
  Toddler: ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
  'Youth / Kids': ['1', '2', '3', '4', '5', '6', '7'],
  "Women's": ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12'],
  "Men's": ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13', '14', '15'],
};

export const OTHER_SIZE = 'Other / Not Sure';

export const CLOTHING_OPTIONS = [
  'Pajamas', 'T-Shirts', 'Long-Sleeve Shirts', 'Jeans', 'Leggings', 'Sweatpants', 'Sweatshirts', 'Hoodies',
  'Dresses', 'Skirts', 'Winter Coat', 'Jacket', 'Socks', 'Underwear', 'Shoes / Sneakers', 'Boots', 'Hat',
  'Gloves', 'Scarf', 'School Uniforms', 'Other',
] as const;

export const GIFT_OPTIONS = [
  'Board Games', 'Video Games', 'Toys / Dolls', 'Building Sets / LEGO', 'Art Supplies', 'Books',
  'Sports Equipment', 'Puzzles', 'Educational Games', 'Music Items', 'Gift Card to a Store', 'Craft Kits', 'Other',
] as const;

export const GENDERS = ['Girl', 'Boy', 'Prefer not to say'] as const;
export const CONTACT_METHODS = ['Text', 'Call', 'Email'] as const;
/** Answers to "Would you prefer to pick up the gifts or have them delivered?" (stored as Transportation Yes/No). */
export const TRANSPORT_OPTIONS = ['I’ll pick them up', 'Please deliver them'] as const;
export const FAVORITE_COLORS = ['Purple', 'Pink', 'Yellow', 'Black', 'Green', 'Rainbow', 'Red', 'Blue', 'Lavender', 'Teal', 'Orange', 'Gold', 'White'] as const;
export const CHIP_IN_AMOUNTS = [25, 50, 100, 150, 250, 500] as const;
export const CARD_FEE = 1.2;
/** Default per-child wishlist budget used for chip-in goals. */
export const GOAL_PER_CHILD = 175;
