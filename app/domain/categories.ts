export const PRODUCT_CATEGORY_TYPES = [
  "Condiments",
  "Beauty",
  "Wellness",
  "Food",
  "Drinkables",
  "Home",
  "Snacks",
  "Etc",
] as const;

export type ProductCategoryType = (typeof PRODUCT_CATEGORY_TYPES)[number];
