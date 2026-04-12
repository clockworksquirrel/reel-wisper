import { queryLLM } from './llm.js';
import { lookupTitle, searchMovie, searchTV, movieToMeta, tvToMeta, getMovieExternalIds, getTVExternalIds, multiSearch, getPersonCredits } from './tmdb.js';
import { searchTVDB, tvdbToMeta } from './tvdb.js';

/**
 * Look up a single suggestion: TMDB first, TVDB fallback.
 */
async function resolveSuggestion(s) {
  // Try TMDB first (better posters/metadata)
  try {
    const meta = await lookupTitle(s.title, s.year, s.type);
    if (meta) {
      console.log(`[ReeL Wisper] TMDB resolved: "${s.title}" → ${meta.id} (${meta.name})`);
      return meta;
    }
  } catch (err) {
    console.error(`[ReeL Wisper] TMDB error for "${s.title}":`, err.message);
  }

  // Fallback to TVDB
  try {
    const tvdbResult = await searchTVDB(s.title, s.type);
    if (tvdbResult) {
      const meta = tvdbToMeta(tvdbResult);
      if (meta) console.log(`[ReeL Wisper] TVDB resolved: "${s.title}" → ${meta.id}`);
      return meta;
    }
  } catch (err) {
    console.error(`[ReeL Wisper] TVDB error for "${s.title}":`, err.message);
  }

  console.warn(`[ReeL Wisper] Could not resolve: "${s.title}" (${s.year})`);
  return null;
}

/**
 * Direct TMDB search fallback when LLM is unavailable.
 * Uses multi-search to find movies, TV shows, and people (with filmography).
 */
async function tmdbDirectSearch(query, type) {
  const metas = [];
  const seen = new Set();

  try {
    const results = await multiSearch(query);

    for (const r of results.slice(0, 15)) {
      if (r.media_type === 'person') {
        // Get person's filmography, pre-split by type
        const credits = await getPersonCredits(r.id);
        const relevantCredits = type === 'series' ? credits.tv : type === 'movie' ? credits.movies : [...credits.movies, ...credits.tv];
        const resolving = [];
        for (const credit of relevantCredits) {
          if (seen.has(credit.id)) continue;
          seen.add(credit.id);
          resolving.push(credit);
          if (resolving.length >= 20) break;
        }
        // Resolve in parallel for speed
        const resolved = await Promise.allSettled(resolving.map(async (credit) => {
          if (credit.media_type === 'movie') {
            const ext = await getMovieExternalIds(credit.id);
            return movieToMeta(credit, ext);
          } else {
            const ext = await getTVExternalIds(credit.id);
            return tvToMeta(credit, ext);
          }
        }));
        for (const res of resolved) {
          if (res.status === 'fulfilled' && res.value) metas.push(res.value);
          if (metas.length >= 20) break;
        }
      } else if (r.media_type === 'movie' && (type === 'movie' || !type)) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        const ext = await getMovieExternalIds(r.id);
        const meta = movieToMeta(r, ext);
        if (meta) metas.push(meta);
      } else if (r.media_type === 'tv' && (type === 'series' || !type)) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        const ext = await getTVExternalIds(r.id);
        const meta = tvToMeta(r, ext);
        if (meta) metas.push(meta);
      }
      if (metas.length >= 20) break;
    }
  } catch (err) {
    console.error('[ReeL Wisper] TMDB direct search error:', err.message);
  }
  return { metas };
}

/**
 * Handle a Stremio catalog search request.
 * Sends the natural language query to the LLM, then resolves each suggestion via TMDB/TVDB.
 */
export async function handleCatalog(args, config) {
  const query = args.extra?.search;
  if (!query) {
    return { metas: [] };
  }

  const { backend, apiKey, baseUrl, model } = config;

  // 1. Ask the LLM for suggestions
  let suggestions;
  try {
    console.log(`[ReeL Wisper] LLM call: model=${model} baseUrl=${baseUrl}`);
    suggestions = await queryLLM({
      query,
      apiKey,
      baseUrl,
      model,
    });
    console.log(`[ReeL Wisper] LLM returned ${suggestions.length} suggestions:`, suggestions.map(s => s.title).join(', '));
  } catch (err) {
    console.error('[ReeL Wisper] LLM error:', err.message);
    // Fallback: use TMDB direct search when LLM fails
    console.log(`[ReeL Wisper] Falling back to TMDB direct search for: "${query}"`);
    return await tmdbDirectSearch(query, args.type);
  }

  // 2. Resolve ALL suggestions in parallel via TMDB → TVDB fallback
  const results = await Promise.allSettled(
    suggestions.map(s => resolveSuggestion(s))
  );

  const metas = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      if (!metas.some(m => m.id === result.value.id)) {
        metas.push(result.value);
      }
    }
  }

  // If LLM gave suggestions but none resolved, try TMDB direct as fallback
  if (metas.length === 0 && suggestions.length > 0) {
    console.log(`[ReeL Wisper] No suggestions resolved, falling back to TMDB direct search`);
    return await tmdbDirectSearch(query, args.type);
  }

  return {
    metas,
    cacheMaxAge: 86400,
    staleRevalidate: 86400,
  };
}
