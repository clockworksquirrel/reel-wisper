function getTvdbApiKey() {
  return process.env.TVDB_API_KEY;
}
const BASE = 'https://api4.thetvdb.com/v4';

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get a TVDB bearer token (cached for 25 days, tokens last 30).
 */
async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: getTvdbApiKey() }),
  });
  if (!res.ok) throw new Error(`TVDB login failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.data?.token;
  tokenExpiry = Date.now() + 25 * 24 * 60 * 60 * 1000; // 25 days
  return cachedToken;
}

/**
 * Search TVDB for a title. Returns the best match or null.
 * type: 'movie' or 'series'
 */
export async function searchTVDB(query, type) {
  const token = await getToken();
  const params = new URLSearchParams({ query });
  if (type === 'movie') params.set('type', 'movie');
  else if (type === 'series') params.set('type', 'series');

  const res = await fetch(`${BASE}/search?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0] || null;
}

/**
 * Extract IMDB ID from a TVDB search result's remote_ids.
 */
export function extractImdbId(tvdbResult) {
  if (!tvdbResult?.remote_ids) return null;
  const imdb = tvdbResult.remote_ids.find(r => r.sourceName === 'IMDB');
  return imdb?.id || null;
}

/**
 * Extract TMDB ID from a TVDB search result's remote_ids.
 */
export function extractTmdbId(tvdbResult) {
  if (!tvdbResult?.remote_ids) return null;
  const tmdb = tvdbResult.remote_ids.find(r => r.sourceName === 'TheMovieDB.com');
  return tmdb?.id || null;
}

/**
 * Convert a TVDB search result into a Stremio meta preview object.
 * Falls back to TVDB data when TMDB isn't available.
 */
export function tvdbToMeta(result) {
  const imdbId = extractImdbId(result);
  if (!imdbId) return null;

  const type = result.type === 'movie' ? 'movie' : 'series';

  return {
    id: imdbId,
    type,
    name: result.name,
    poster: result.image_url || undefined,
    posterShape: 'regular',
    description: result.overview || undefined,
    releaseInfo: result.year || undefined,
  };
}
