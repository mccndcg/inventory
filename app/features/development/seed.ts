import type { PersistenceDependencies } from "../../local-data/transactions";
import type { InventoryDatabase } from "../../local-data/database";
import { createProduct, normalizeProductName, type ProductFields } from "../../local-data/products";
import goods from "./goods.json";

const seedProducts = goods satisfies readonly ProductFields[];
const firstFiveSeedNames = seedProducts.slice(0, 5).map((product) => product.name);

export const DEVELOPMENT_SEED_PRODUCT_COUNT = seedProducts.length;

export async function seedDevelopmentProducts(
  db: InventoryDatabase,
  dependencies: PersistenceDependencies,
): Promise<{ created: number; skipped: boolean }> {
  const expectedNames = firstFiveSeedNames.map(normalizeProductName);
  const existing = await db.products
    .where("normalizedName")
    .anyOf(expectedNames)
    .toArray();
  const existingNames = new Set(existing.map((product) => product.normalizedName));

  if (expectedNames.every((name) => existingNames.has(name))) {
    return { created: 0, skipped: true };
  }

  for (const product of seedProducts) {
    await createProduct(db, product, dependencies);
  }
  return { created: seedProducts.length, skipped: false };
}
