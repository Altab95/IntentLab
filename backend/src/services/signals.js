/**
 * Deterministic feature extraction from an event stream.
 * Feeds the LLM as grounded evidence and powers the heuristic fallback.
 */

const STATE_HINTS = {
  browser: ["shallow_product_views", "content_browsing", "no_cart", "idle_or_exit"],
  comparer: ["multi_sku_views", "revisit_skus", "size_guide", "wishlist_multi"],
  discount_seeker: ["sale_path", "promo_attempts", "compare_price_present"],
  cart_abandoner: ["cart_or_checkout", "checkout_stall", "exit_from_cart", "no_purchase"],
  loyal_customer: ["returning", "prior_orders", "replenish", "purchase"],
};

function extractSignals(events = []) {
  const types = events.map((e) => e.type);
  const productViews = events.filter((e) => e.type === "product_view");
  const uniqueSkus = new Set(productViews.map((e) => e.productId).filter(Boolean));
  const skuVisitCounts = {};
  for (const pv of productViews) {
    if (!pv.productId) continue;
    skuVisitCounts[pv.productId] = (skuVisitCounts[pv.productId] || 0) + 1;
  }
  const revisitedSkus = Object.values(skuVisitCounts).filter((n) => n >= 2).length;

  const avgTimeOnPdp =
    productViews.length === 0
      ? 0
      : productViews.reduce((s, e) => s + (e.timeOnPageSec || 0), 0) / productViews.length;

  const paths = events.filter((e) => e.path).map((e) => e.path);
  const salePathHits = paths.filter((p) => /sale|outlet|clearance/i.test(p)).length;
  const promoAttempts = events.filter((e) => e.type === "promo_apply").length;
  const promoInvalid = events.filter((e) => e.type === "promo_apply" && e.result === "invalid").length;
  const promoFocus = types.includes("promo_field_focus");

  const addToCarts = events.filter((e) => e.type === "add_to_cart").length;
  const checkoutStarts = types.filter((t) => t === "checkout_start").length;
  const checkoutSteps = events.filter((e) => e.type === "checkout_step").length;
  const purchases = events.filter((e) => e.type === "purchase").length;
  const cartViews = paths.filter((p) => p === "/cart").length;
  const exitFromCart = events.some((e) => e.type === "page_exit" && e.path === "/cart");
  const longIdle = events.some((e) => e.type === "session_idle" && (e.idleSec || 0) >= 90);

  const sessionStart = events.find((e) => e.type === "session_start");
  const returning = Boolean(sessionStart?.returning);
  const priorOrders = sessionStart?.priorOrders || 0;
  const replenishPath = paths.some((p) => /replenish|account|reorder/i.test(p));
  const previouslyPurchasedViews = productViews.filter((e) => e.previouslyPurchased).length;
  const wishlistAdds = events.filter((e) => e.type === "wishlist_add").length;
  const sizeGuideOpens = events.filter((e) => e.type === "size_guide_open").length;
  const contentViews = paths.filter((p) => /blog|stories|lookbook/i.test(p)).length;
  const comparePriceViews = productViews.filter((e) => e.comparePrice != null).length;

  const durationSec = events.length ? Math.max(...events.map((e) => e.t || 0)) : 0;

  const evidence = [];

  if (uniqueSkus.size >= 3 && revisitedSkus >= 1) {
    evidence.push({
      signal: "multi_sku_comparison",
      detail: `Viewed ${uniqueSkus.size} SKUs with ${revisitedSkus} revisited`,
      weight: 0.85,
      supports: ["comparer"],
    });
  }
  if (avgTimeOnPdp >= 35 && uniqueSkus.size >= 2) {
    evidence.push({
      signal: "deep_pdp_dwell",
      detail: `Avg PDP time ${avgTimeOnPdp.toFixed(0)}s across ${productViews.length} views`,
      weight: 0.7,
      supports: ["comparer", "cart_abandoner"],
    });
  }
  if (sizeGuideOpens > 0 || wishlistAdds >= 2) {
    evidence.push({
      signal: "pre_purchase_research",
      detail: `Size guide opens: ${sizeGuideOpens}, wishlist adds: ${wishlistAdds}`,
      weight: 0.65,
      supports: ["comparer"],
    });
  }
  if (salePathHits > 0 || promoAttempts > 0 || promoFocus) {
    evidence.push({
      signal: "discount_hunting",
      detail: `Sale paths: ${salePathHits}, promo attempts: ${promoAttempts} (${promoInvalid} invalid)`,
      weight: 0.9,
      supports: ["discount_seeker"],
    });
  }
  if (comparePriceViews > 0) {
    evidence.push({
      signal: "markdown_affinity",
      detail: `${comparePriceViews} PDPs showed compare-at pricing`,
      weight: 0.55,
      supports: ["discount_seeker"],
    });
  }
  if ((addToCarts > 0 || cartViews > 0) && checkoutStarts > 0 && purchases === 0) {
    evidence.push({
      signal: "checkout_abandonment",
      detail: `Reached checkout (${checkoutSteps} steps) without purchase; cart views: ${cartViews}`,
      weight: 0.95,
      supports: ["cart_abandoner"],
    });
  }
  if (exitFromCart || (longIdle && (addToCarts > 0 || cartViews > 0) && purchases === 0)) {
    evidence.push({
      signal: "cart_stall",
      detail: exitFromCart ? "Exited from /cart" : "Long idle with items in funnel",
      weight: 0.8,
      supports: ["cart_abandoner"],
    });
  }
  if (returning || priorOrders >= 2 || previouslyPurchasedViews > 0 || replenishPath) {
    evidence.push({
      signal: "loyalty_markers",
      detail: `returning=${returning}, priorOrders=${priorOrders}, repurchase views=${previouslyPurchasedViews}`,
      weight: 0.9,
      supports: ["loyal_customer"],
    });
  }
  if (purchases > 0) {
    evidence.push({
      signal: "completed_purchase",
      detail: `Purchase events: ${purchases}`,
      weight: 0.75,
      supports: ["loyal_customer"],
    });
  }
  if (
    uniqueSkus.size <= 2 &&
    avgTimeOnPdp < 15 &&
    addToCarts === 0 &&
    promoAttempts === 0 &&
    purchases === 0
  ) {
    evidence.push({
      signal: "shallow_browse",
      detail: `Low dwell (${avgTimeOnPdp.toFixed(0)}s avg), no cart, content views: ${contentViews}`,
      weight: 0.8,
      supports: ["browser"],
    });
  }
  if (contentViews > 0 && addToCarts === 0) {
    evidence.push({
      signal: "content_first",
      detail: `Visited ${contentViews} content paths without carting`,
      weight: 0.5,
      supports: ["browser"],
    });
  }

  const scores = {
    browser: 0.15,
    comparer: 0.15,
    discount_seeker: 0.15,
    cart_abandoner: 0.15,
    loyal_customer: 0.15,
  };

  for (const e of evidence) {
    for (const state of e.supports) {
      scores[state] += e.weight;
    }
  }

  // Soft priors from raw counts
  if (promoAttempts >= 2) scores.discount_seeker += 0.4;
  if (uniqueSkus.size >= 3) scores.comparer += 0.35;
  if (checkoutStarts && !purchases) scores.cart_abandoner += 0.45;
  if (priorOrders >= 2 && purchases) scores.loyal_customer += 0.5;
  if (addToCarts === 0 && purchases === 0 && uniqueSkus.size <= 2) scores.browser += 0.35;

  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([state, score]) => ({ state, score: Number(score.toFixed(3)) }));

  const top = ranked[0];
  const second = ranked[1];
  const margin = top.score - (second?.score || 0);
  const total = ranked.reduce((s, r) => s + r.score, 0) || 1;
  const share = top.score / total;
  const confidence = Math.max(
    0.4,
    Math.min(0.94, 0.38 + share * 0.35 + Math.min(margin, 1.5) * 0.18 + Math.min(evidence.length, 5) * 0.03),
  );

  return {
    features: {
      eventCount: events.length,
      durationSec,
      uniqueSkus: uniqueSkus.size,
      revisitedSkus,
      avgTimeOnPdp: Number(avgTimeOnPdp.toFixed(1)),
      productViews: productViews.length,
      addToCarts,
      cartViews,
      checkoutStarts,
      checkoutSteps,
      purchases,
      promoAttempts,
      promoInvalid,
      salePathHits,
      wishlistAdds,
      sizeGuideOpens,
      contentViews,
      returning,
      priorOrders,
      previouslyPurchasedViews,
      exitFromCart,
      longIdle,
    },
    evidence,
    heuristic: {
      state: top.state,
      confidence: Number(confidence.toFixed(2)),
      ranked,
    },
    stateHints: STATE_HINTS,
  };
}

module.exports = { extractSignals };
