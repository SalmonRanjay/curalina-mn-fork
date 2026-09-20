/**
 * recommendation response -> app `products` row mapping (phase A5,
 * packet 2 of 3).
 *
 * A real gap, not papered over: recommendation's `Product` domain class
 * (`ai_services/recommendation/src/curalina_recommendation/domain/product.py`
 * lines 1-9) deliberately has no `asset_refs` field yet, and recommendation
 * has no per-product or per-asset HTTP endpoint (only whole-catalogue
 * import via `POST /v1/catalogue/imports`, which takes a `source_uri` +
 * `supplier_id`, not individual product/asset payloads). This module
 * therefore does not send app `products` rows into recommendation as
 * `Product`/`Asset` objects — there is no endpoint that accepts that shape.
 * What it does instead is the "product row -> Product + Asset refs" table
 * row's other direction: take recommendation's response
 * (`BundleLineItem`/`RankedCandidate`, both of which carry a
 * `product_id`), resolve it back to the app's own `products` row by ID,
 * and build the customer-facing view from that row.
 *
 * `tradePrice` is never emitted here — the omission is structural
 * (`AppProductRef` has no `tradePrice` member), per
 * `03_data_contracts.md`'s explicit prohibition on exposing trade price in
 * customer-facing responses.
 */

import type { Product } from "@shared/schema";
import type { BundleLineItemShape } from "./recommendation-client.js";

/**
 * Customer-facing view of an app `products` row, built after resolving a
 * recommendation `BundleLineItem`'s `product_id` back to that row.
 * Deliberately has no `tradePrice` field — see module docstring.
 */
export interface AppProductRef {
  sku: string;
  name: string;
  price: string;
  availability: string;
  images: string[] | null;
}

/**
 * Thrown when a recommendation line item's `product_id` has no matching
 * row in the app's own `products` table. The mapper never fabricates a
 * placeholder product to paper over the mismatch — a missing match is a
 * data-integrity problem that must surface, not be silently substituted.
 */
export class ProductMappingMismatchError extends Error {
  readonly productId: string;

  constructor(productId: string) {
    super(
      `No app product row found for recommendation product_id "${productId}"`
    );
    this.name = "ProductMappingMismatchError";
    this.productId = productId;
  }
}

/**
 * Resolves a recommendation `BundleLineItem` (or a `RankedCandidate`,
 * which shares the same `product_id`/`category` fields) to the app's own
 * `products` row, and returns the customer-facing view of that row.
 *
 * `appProduct` must already be looked up by the caller (e.g. via
 * `storage.getProductById(lineItem.product_id)`); this function only
 * asserts the IDs actually match and performs the field projection — it
 * does not query storage itself, keeping this module storage-access-free
 * per the adapter layer's boundaries.
 */
export function toAppProductRef(
  lineItem: Pick<BundleLineItemShape, "product_id">,
  appProduct: Product | undefined | null
): AppProductRef {
  if (!appProduct || appProduct.id !== lineItem.product_id) {
    throw new ProductMappingMismatchError(lineItem.product_id);
  }

  return {
    sku: appProduct.sku,
    name: appProduct.name,
    price: appProduct.price,
    availability: appProduct.availability,
    images: appProduct.images,
  };
}
