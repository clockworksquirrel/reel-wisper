const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';

/**
 * Search TMDB for a movie by title (and optional year).
 * Returns the best match or null.
 */
export async function searchMovie(title, year) {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    query: title,
    include_adult: 'false',
  });
  if (year) params.set('year', year);

  const res = await fetch(`${BASE}/search/movie?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] || null;
}

/**
 * Search TMDB for a TV series by title.
 * Returns the best match or null.
 */
export async function searchTV(title, year) {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    query: title,
    include_adult: 'false',
  });
  if (year) params.set('first_air_date_year', year);

  const res = await fetch(`${BASE}/search/tv?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] || null;
}

/**
 * Get external IDs (including IMDB ID) for a TMDB movie.
 */
export async function getMovieExternalIds(tmdbId) {
  const res = await fetch(`${BASE}/movie/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
  if (!res.ok) return {};
  return res.json();
}

/**
 * Get external IDs for a TMDB TV series.
 */
export async function getTVExternalIds(tmdbId) {
  const res = await fetch(`${BASE}/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
  if (!res.ok) return {};
  return res.json();
}

/**
 * Get full movie details from TMDB.
 */
export async function getMovieDetails(tmdbId) {
  const res = await fetch(`${BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Get full TV series details from TMDB.
 */
export async function getTVDetails(tmdbId) {
  const res = await fetch(`${BASE}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Convert a TMDB movie result into a Stremio meta preview object.
 */
export function movieToMeta(movie, externalIds) {
  const imdbId = externalIds?.imdb_id || movie?.external_ids?.imdb_id;
  if (!imdbId) return null;

  return {
    id: imdbId,
    type: 'movie',
    name: movie.title,
    poster: movie.poster_path ? `${IMG_BASE}/w500${movie.poster_path}` : undefined,
    posterShape: 'regular',
    background: movie.backdrop_path ? `${IMG_BASE}/w1280${movie.backdrop_path}` : undefined,
    description: movie.overview || undefined,
    releaseInfo: movie.release_date ? movie.release_date.slice(0, 4) : undefined,
    imdbRating: movie.vote_average ? String(Math.round(movie.vote_average * 10) / 10) : undefined,
    genres: movie.genre_ids ? undefined : movie.genres?.map(g => g.name),
  };
}

/**
 * Convert a TMDB TV result into a Stremio meta preview object.
 */
export function tvToMeta(show, externalIds) {
  const imdbId = externalIds?.imdb_id || show?.external_ids?.imdb_id;
  if (!imdbId) return null;

  return {
    id: imdbId,
    type: 'series',
    name: show.name,
    poster: show.poster_path ? `${IMG_BASE}/w500${show.poster_path}` : undefined,
    posterShape: 'regular',
    background: show.backdrop_path ? `${IMG_BASE}/w1280${show.backdrop_path}` : undefined,
    description: show.overview || undefined,
    releaseInfo: show.first_air_date ? show.first_air_date.slice(0, 4) : undefined,
    imdbRating: show.vote_average ? String(Math.round(show.vote_average * 10) / 10) : undefined,
    genres: show.genre_ids ? undefined : show.genres?.map(g => g.name),
  };
}

/**
 * Search for a title (try movie first, then TV) and return a Stremio meta object.
 */
export async function lookupTitle(title, year, preferredType) {
  // Try the preferred type first
  if (preferredType === 'series' || preferredType === 'tv') {
    const tv = await searchTV(title, year);
    if (tv) {
      const ext = await getTVExternalIds(tv.id);
      const meta = tvToMeta(tv, ext);
      if (meta) return meta;
    }
    // Fall back to movie
    const movie = await searchMovie(title, year);
    if (movie) {
      const ext = await getMovieExternalIds(movie.id);
      return movieToMeta(movie, ext);
    }
    return null;
  }

  // Default: try movie first, then TV
  const movie = await searchMovie(title, year);
  if (movie) {
    const ext = await getMovieExternalIds(movie.id);
    const meta = movieToMeta(movie, ext);
    if (meta) return meta;
  }

  const tv = await searchTV(title, year);
  if (tv) {
    const ext = await getTVExternalIds(tv.id);
    return tvToMeta(tv, ext);
  }

  return null;
}
