import { getMovieDetails, getTVDetails, movieToMeta, tvToMeta } from './tmdb.js';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE = 'https://api.themoviedb.org/3';

/**
 * Handle a Stremio meta request — look up full details for a given IMDB ID.
 */
export async function handleMeta(args) {
  const { id, type } = args;
  if (!id?.startsWith('tt')) return { meta: null };

  // Find the TMDB ID from the IMDB ID
  const findRes = await fetch(
    `${BASE}/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`
  );
  if (!findRes.ok) return { meta: null };
  const found = await findRes.json();

  if (type === 'movie' && found.movie_results?.length) {
    const tmdbId = found.movie_results[0].id;
    const details = await getMovieDetails(tmdbId);
    if (!details) return { meta: null };
    const meta = movieToMeta(details, details.external_ids);
    if (meta) {
      meta.genres = details.genres?.map(g => g.name);
      meta.runtime = details.runtime ? `${details.runtime} min` : undefined;
      meta.writer = details.credits?.crew?.filter(c => c.job === 'Writer').map(c => c.name);
      meta.director = details.credits?.crew?.filter(c => c.job === 'Director').map(c => c.name);
    }
    return { meta };
  }

  if (type === 'series' && found.tv_results?.length) {
    const tmdbId = found.tv_results[0].id;
    const details = await getTVDetails(tmdbId);
    if (!details) return { meta: null };
    const meta = tvToMeta(details, details.external_ids);
    if (meta) {
      meta.genres = details.genres?.map(g => g.name);
    }
    return { meta };
  }

  return { meta: null };
}
