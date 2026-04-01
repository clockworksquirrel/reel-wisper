import { queryLLM } from './llm.js';
import { lookupTitle } from './tmdb.js';
import { searchTVDB, tvdbToMeta } from './tvdb.js';

/**
 * Look up a single suggestion: TMDB first, TVDB fallback.
 */
async function resolveSuggestion(s) {
  // Try TMDB first (better posters/metadata)
  const meta = await lookupTitle(s.title, s.year, s.type);
  if (meta) return meta;

  // Fallback to TVDB
  const tvdbResult = await searchTVDB(s.title, s.type);
  if (tvdbResult) return tvdbToMeta(tvdbResult);

  return null;
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
    suggestions = await queryLLM({
      query,
      apiKey,
      baseUrl,
      model,
    });
  } catch (err) {
    console.error('[ReelWhisper] LLM error:', err.message);
    return { metas: [] };
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

  return {
    metas,
    cacheMaxAge: 86400,
    staleRevalidate: 86400,
  };
}
