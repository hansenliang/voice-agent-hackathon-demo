import { tool } from "ai";
import { z } from "zod";
import path from "node:path";
import { readFile } from "node:fs/promises";

/**
 * Wayfair product research tools used by the voice-research agent.
 *
 * Two tools: search by filters, get full details by id. Both read the local
 * JSON catalog so the agent has grounded, real specs to talk about — no
 * hallucinated products, prices, or dimensions.
 */

type Product = {
  id: string;
  name: string;
  category: string;
  price_usd: number;
  dimensions_in: { width: number; depth: number; height: number };
  seats: number | null;
  materials: string[];
  colors: string[];
  pet_friendly: boolean;
  kid_friendly: boolean;
  stain_resistant: boolean;
  assembly_required: string;
  shipping: {
    standard_days: string;
    express_days: string;
    express_fee_usd: number;
  };
  room_recommendations: string[];
  min_room_size_ft: { width: number; depth: number };
  review_summary: string;
  rating: number;
};

async function loadProducts(): Promise<Product[]> {
  const file = path.join(process.cwd(), "data", "wayfair-products.json");
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as Product[];
}

/**
 * Loose color synonyms — voice users say "dark gray" when they mean
 * "charcoal" or "slate"; "off-white" for "ivory"/"oatmeal"; etc. Map any
 * user-supplied color term to the catalog's actual color labels.
 */
const COLOR_SYNONYMS: Record<string, string[]> = {
  gray: ["charcoal", "slate", "dove gray", "dove", "graphite"],
  grey: ["charcoal", "slate", "dove gray", "dove", "graphite"],
  "dark gray": ["charcoal", "slate", "graphite", "midnight blue"],
  "dark grey": ["charcoal", "slate", "graphite", "midnight blue"],
  "light gray": ["dove gray", "dove", "slate"],
  "light grey": ["dove gray", "dove", "slate"],
  charcoal: ["charcoal", "graphite", "slate"],
  black: ["black", "charcoal"],
  white: ["ivory", "oatmeal", "cream"],
  "off-white": ["ivory", "oatmeal", "cream"],
  beige: ["oatmeal", "cream", "camel"],
  tan: ["camel", "cognac", "oatmeal"],
  brown: ["walnut", "cognac", "camel"],
  blue: ["navy", "midnight blue", "indigo"],
  "navy blue": ["navy", "midnight blue"],
  green: ["moss green", "emerald"],
  red: ["rust"],
};

function colorMatches(productColors: string[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const candidates = new Set<string>([q]);
  if (COLOR_SYNONYMS[q]) {
    for (const syn of COLOR_SYNONYMS[q]) {
      candidates.add(syn.toLowerCase());
    }
  }
  // Also pair-check: if the user said "charcoal", map to itself; if user
  // said any catalog color verbatim, accept it.
  const productSet = productColors.map((c) => c.toLowerCase());
  for (const cand of candidates) {
    for (const pc of productSet) {
      if (pc.includes(cand) || cand.includes(pc)) {
        return true;
      }
    }
  }
  return false;
}

function freeTextMatches(p: Product, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    p.name,
    p.category,
    p.review_summary,
    ...p.materials,
    ...p.colors,
    ...p.room_recommendations,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function summarize(p: Product): string {
  const dim = `${p.dimensions_in.width}"W x ${p.dimensions_in.depth}"D`;
  const pet = p.pet_friendly ? "pet-friendly" : "not pet-friendly";
  const kid = p.kid_friendly ? "kid-friendly" : "not kid-friendly";
  return `${p.name} — ${p.category}, $${p.price_usd}, ${dim}, ${pet}, ${kid}, rating ${p.rating}. ${p.review_summary}`;
}

export const searchProducts = tool({
  description:
    "Search the Wayfair product catalog. Filter by category, max/min price, room size, pet/kid friendliness, color, and free-text keywords. Returns up to 8 matching products with key specs.",
  inputSchema: z.object({
    category: z
      .string()
      .optional()
      .describe("e.g. 'sectional', 'coffee table', 'rug', 'accent chair'"),
    max_price_usd: z.number().optional(),
    min_price_usd: z.number().optional(),
    pet_friendly: z.boolean().optional(),
    kid_friendly: z.boolean().optional(),
    color: z
      .string()
      .optional()
      .describe(
        "e.g. 'charcoal', 'dark gray', 'navy'. Matched loosely against catalog colors with a synonym map.",
      ),
    fits_room_width_ft: z
      .number()
      .optional()
      .describe(
        "Room width in feet — return only products whose min_room_size_ft.width <= this.",
      ),
    fits_room_depth_ft: z
      .number()
      .optional()
      .describe(
        "Room depth in feet — return only products whose min_room_size_ft.depth <= this.",
      ),
    query: z
      .string()
      .optional()
      .describe("Free-text keyword fallback against name, materials, reviews."),
  }),
  execute: async (filters) => {
    const products = await loadProducts();
    const filtered = products.filter((p) => {
      if (
        filters.category &&
        !p.category.toLowerCase().includes(filters.category.toLowerCase())
      ) {
        return false;
      }
      if (
        filters.max_price_usd !== undefined &&
        p.price_usd > filters.max_price_usd
      ) {
        return false;
      }
      if (
        filters.min_price_usd !== undefined &&
        p.price_usd < filters.min_price_usd
      ) {
        return false;
      }
      if (filters.pet_friendly === true && !p.pet_friendly) return false;
      if (filters.kid_friendly === true && !p.kid_friendly) return false;
      if (filters.color && !colorMatches(p.colors, filters.color)) return false;
      if (
        filters.fits_room_width_ft !== undefined &&
        p.min_room_size_ft.width > filters.fits_room_width_ft
      ) {
        return false;
      }
      if (
        filters.fits_room_depth_ft !== undefined &&
        p.min_room_size_ft.depth > filters.fits_room_depth_ft
      ) {
        return false;
      }
      if (filters.query && !freeTextMatches(p, filters.query)) return false;
      return true;
    });

    const matches = filtered.slice(0, 8).map((p) => ({
      id: p.id,
      name: p.name,
      price_usd: p.price_usd,
      category: p.category,
      dimensions_in: p.dimensions_in,
      colors: p.colors,
      pet_friendly: p.pet_friendly,
      kid_friendly: p.kid_friendly,
      rating: p.rating,
      summary: summarize(p),
    }));

    return {
      filters_applied: filters,
      result_count: matches.length,
      total_in_catalog: products.length,
      matches,
    };
  },
});

export const getProductDetails = tool({
  description:
    "Get full details for a single product by id, including dimensions, materials, all available colors, review summary, and shipping options.",
  inputSchema: z.object({
    product_id: z.string().describe("Product id, e.g. 'wf-001'"),
  }),
  execute: async ({ product_id }) => {
    const products = await loadProducts();
    const found = products.find((p) => p.id === product_id);
    if (!found) {
      return {
        error: `Product not found: ${product_id}. Try search_products to find a valid id.`,
      };
    }
    return found;
  },
});

/** Tool set keyed by the snake_case names the model is asked to call. */
export const wayfairResearchTools = {
  search_products: searchProducts,
  get_product_details: getProductDetails,
};
