/**
 * GIPHY Sticker fetch utility.
 * Fetches a reaction sticker URL from the GIPHY API for a given tag.
 * Results are cached in memory to avoid redundant API calls per pipeline run.
 */

const GIPHY_API_BASE = 'https://api.giphy.com/v1/stickers/search';
const cache = new Map<string, string>();

/**
 * Fetches a transparent sticker GIF URL from GIPHY for the given reaction tag.
 * Returns null if the API key is not configured, the request fails, or no results found.
 */
export async function fetchReactionGif(tag: string): Promise<string | null> {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    console.warn('[GIPHY] GIPHY_API_KEY not set — skipping reaction sticker.');
    return null;
  }

  const normalizedTag = tag.trim().toLowerCase();

  // Return cached result if available
  if (cache.has(normalizedTag)) {
    return cache.get(normalizedTag)!;
  }

  try {
    const url = new URL(GIPHY_API_BASE);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('q', normalizedTag);
    url.searchParams.set('limit', '10');
    url.searchParams.set('rating', 'g');
    url.searchParams.set('lang', 'en');

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.warn(`[GIPHY] API error ${response.status} for tag "${normalizedTag}"`);
      return null;
    }

    const json = await response.json() as GiphySearchResponse;
    const results = json?.data;

    if (!results || results.length === 0) {
      console.warn(`[GIPHY] No results for tag "${normalizedTag}"`);
      return null;
    }

    // Pick randomly from the top 5 to add variety across runs
    const pick = results[Math.floor(Math.random() * Math.min(5, results.length))];
    // Prefer WebP for transparency; fall back to GIF original
    const gifUrl =
      pick.images?.fixed_height?.webp ||
      pick.images?.fixed_height?.url ||
      pick.images?.original?.url ||
      null;

    if (gifUrl) {
      cache.set(normalizedTag, gifUrl);
      console.log(`[GIPHY] Fetched sticker for "${normalizedTag}": ${gifUrl}`);
    }

    return gifUrl;
  } catch (err: any) {
    console.warn(`[GIPHY] Failed to fetch sticker for "${normalizedTag}":`, err.message || err);
    return null;
  }
}

// ---- GIPHY API types ----

interface GiphyImage {
  url?: string;
  webp?: string;
}

interface GiphyItem {
  images: {
    fixed_height?: GiphyImage;
    fixed_height_small?: GiphyImage;
    original?: GiphyImage;
  };
}

interface GiphySearchResponse {
  data: GiphyItem[];
  pagination: { total_count: number; count: number; offset: number };
}
