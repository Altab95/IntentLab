/**
 * Mock shopper event streams for demo + evaluation.
 * Event shape: { t: ISO timestamp offset seconds from session start, type, ...payload }
 */

const STATES = [
  "browser",
  "comparer",
  "discount_seeker",
  "cart_abandoner",
  "loyal_customer",
];

const sessions = [
  {
    id: "sess_browse_01",
    label: "Casual browser",
    expectedState: "browser",
    persona: "Evening scroll — low intent",
    events: [
      { t: 0, type: "page_view", path: "/", referrer: "instagram" },
      { t: 12, type: "page_view", path: "/collections/new-arrivals" },
      { t: 45, type: "product_view", productId: "sku_tee_01", price: 48, timeOnPageSec: 8 },
      { t: 58, type: "page_view", path: "/collections/new-arrivals" },
      { t: 90, type: "product_view", productId: "sku_hat_02", price: 32, timeOnPageSec: 6 },
      { t: 110, type: "page_view", path: "/blog/summer-edit" },
      { t: 180, type: "session_idle", idleSec: 70 },
    ],
  },
  {
    id: "sess_compare_01",
    label: "Active comparer",
    expectedState: "comparer",
    persona: "Narrowing SKUs side-by-side",
    events: [
      { t: 0, type: "page_view", path: "/collections/running-shoes" },
      { t: 20, type: "product_view", productId: "sku_run_a", price: 140, timeOnPageSec: 42 },
      { t: 70, type: "product_view", productId: "sku_run_b", price: 155, timeOnPageSec: 55 },
      { t: 140, type: "product_view", productId: "sku_run_a", price: 140, timeOnPageSec: 38 },
      { t: 190, type: "product_view", productId: "sku_run_c", price: 129, timeOnPageSec: 48 },
      { t: 250, type: "size_guide_open", productId: "sku_run_b" },
      { t: 280, type: "product_view", productId: "sku_run_b", price: 155, timeOnPageSec: 60 },
      { t: 350, type: "wishlist_add", productId: "sku_run_b" },
      { t: 360, type: "wishlist_add", productId: "sku_run_a" },
    ],
  },
  {
    id: "sess_discount_01",
    label: "Discount seeker",
    expectedState: "discount_seeker",
    persona: "Hunting codes before commit",
    events: [
      { t: 0, type: "page_view", path: "/collections/sale" },
      { t: 15, type: "product_view", productId: "sku_hoodie_01", price: 89, comparePrice: 120, timeOnPageSec: 25 },
      { t: 50, type: "add_to_cart", productId: "sku_hoodie_01", price: 89 },
      { t: 70, type: "page_view", path: "/cart" },
      { t: 85, type: "promo_field_focus" },
      { t: 95, type: "promo_apply", code: "SAVE20", result: "invalid" },
      { t: 110, type: "promo_apply", code: "WELCOME15", result: "invalid" },
      { t: 130, type: "promo_apply", code: "FREESHIP", result: "valid" },
      { t: 150, type: "page_view", path: "/collections/sale" },
      { t: 180, type: "product_view", productId: "sku_tee_sale", price: 28, comparePrice: 45, timeOnPageSec: 18 },
    ],
  },
  {
    id: "sess_abandon_01",
    label: "Cart abandoner",
    expectedState: "cart_abandoner",
    persona: "High intent stall at checkout",
    events: [
      { t: 0, type: "product_view", productId: "sku_bag_01", price: 198, timeOnPageSec: 50 },
      { t: 60, type: "add_to_cart", productId: "sku_bag_01", price: 198 },
      { t: 75, type: "page_view", path: "/cart" },
      { t: 95, type: "checkout_start" },
      { t: 120, type: "checkout_step", step: "shipping" },
      { t: 160, type: "checkout_step", step: "payment" },
      { t: 200, type: "checkout_field_blur", field: "card_number" },
      { t: 280, type: "page_view", path: "/cart" },
      { t: 320, type: "session_idle", idleSec: 120 },
      { t: 450, type: "page_exit", path: "/cart" },
    ],
  },
  {
    id: "sess_loyal_01",
    label: "Loyal customer",
    expectedState: "loyal_customer",
    persona: "Returning buyer with history",
    events: [
      { t: 0, type: "session_start", returning: true, priorOrders: 4, daysSinceLastOrder: 18 },
      { t: 5, type: "page_view", path: "/account" },
      { t: 20, type: "page_view", path: "/collections/replenish" },
      { t: 40, type: "product_view", productId: "sku_serum_01", price: 62, previouslyPurchased: true, timeOnPageSec: 22 },
      { t: 70, type: "add_to_cart", productId: "sku_serum_01", price: 62 },
      { t: 85, type: "product_view", productId: "sku_moisturizer_02", price: 48, previouslyPurchased: true, timeOnPageSec: 15 },
      { t: 110, type: "add_to_cart", productId: "sku_moisturizer_02", price: 48 },
      { t: 125, type: "page_view", path: "/cart" },
      { t: 140, type: "checkout_start" },
      { t: 175, type: "purchase", orderValue: 110, items: 2 },
    ],
  },
];

function listSessions() {
  return sessions.map(({ id, label, expectedState, persona, events }) => ({
    id,
    label,
    expectedState,
    persona,
    eventCount: events.length,
    durationSec: events.length ? events[events.length - 1].t : 0,
  }));
}

function getSession(id) {
  return sessions.find((s) => s.id === id) || null;
}

module.exports = { STATES, sessions, listSessions, getSession };
