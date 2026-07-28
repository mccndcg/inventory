import type { InventoryDatabase } from "./database";
import {
  createOpeningDraft,
  finalizeOpening,
  prepareOpeningReview,
} from "./opening";
import { searchProducts } from "./products";
import type { PersistenceDependencies } from "./transactions";

export async function finalizeZeroOpeningForTest(
  db: InventoryDatabase,
  dependencies: PersistenceDependencies,
): Promise<void> {
  const products = await searchProducts(db, "");
  const draft = await createOpeningDraft(
    db,
    {
      stockCounts: products.map(({ id }) => ({
        productId: id,
        countedQuantity: 0,
      })),
      countedCashMinor: 0,
      recorderName: "Test recorder",
      verifierName: "Test verifier",
    },
    dependencies,
  );
  const review = await prepareOpeningReview(db, draft.id, dependencies);
  await finalizeOpening(
    db,
    {
      batchId: review.id,
      reportSha256: review.reportSha256 ?? "",
      approvedBy: "Test approver",
      approvalStatement: "Approved for isolated automated test.",
    },
    dependencies,
  );
}
