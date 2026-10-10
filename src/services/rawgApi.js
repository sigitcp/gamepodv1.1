const API_BASE = "https://api.rawg.io/api";
const API_KEY = import.meta.env.VITE_RAWG_API_KEY;

export async function fetchGames(page = 1, search = "", options = {}) {
  const {
    genres = [],
    platforms = [],
    esrbRatings = [],
    ordering = "-rating",
    pageSize = 20,
  } = options;

  let endpoint = `/games?page=${page}&page_size=${pageSize}&ordering=${ordering}`;

  if (search.trim()) endpoint += `&search=${encodeURIComponent(search.trim())}`;

  if (genres.length > 0) {
    const genreSlugs = genres.map(g =>
      g.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and")
    );
    endpoint += `&genres=${genreSlugs.join(",")}`;
  }

  if (platforms.length > 0) {
    endpoint += `&platforms=${platforms.join(",")}`;
  }

  if (esrbRatings.length > 0) {
    endpoint += `&esrb_rating=${esrbRatings.join(",")}`;
  }

  return fetchData(endpoint);
}

export async function fetchPlatforms() {
  return fetchData("/platforms");
}

export async function fetchGameDetail(id) {
  return fetchData(`/games/${id}`);
}

export async function fetchScreenshots(id) {
  try {
    const data = await fetchData(`/games/${id}/screenshots`);
    return data.results || [];
  } catch (error) {
    console.warn("Failed to take a screenshot:", error);
    return [];
  }
}

export async function fetchMovies(id) {
  try {
    const data = await fetchData(`/games/${id}/movies`);
    return data.results || [];
  } catch (error) {
    console.warn("Failed to retrieve trailer:", error);
    return [];
  }
}

async function fetchData(endpoint) {
  const separator = endpoint.includes("?") ? "&" : "?";
  const response = await fetch(
    `${API_BASE}${endpoint}${separator}key=${API_KEY}`
  );

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      if (data.detail) message += ` - ${data.detail}`;
    } catch (_) {}
    throw new Error(message);
  }
  return response.json();
}

export async function fetchGenres() {
  return fetchData("/genres");
}

export async function fetchCandidateGames(
  genres = [],
  searchQuery = "",
  count = 40
) {
  try {
    let endpoint = `/games?page_size=${count}&ordering=-rating`;

    if (searchQuery && searchQuery.trim().length > 3) {
      endpoint += `&search=${encodeURIComponent(searchQuery.trim())}`;
    } else if (genres.length > 0) {
      const genreSlugs = genres.map(g => g.toLowerCase().replace(/\s+/g, "-"));
      endpoint += `&genres=${genreSlugs.join(",")}`;
    }

    const data = await fetchData(endpoint);
    return data.results || [];
  } catch (error) {
    console.error("Failed to retrieve game candidates:", error);
    throw error;
  }
}

export async function searchGamesForSeed(query, limit = 10) {
  if (!query.trim()) return [];

  try {
    const endpoint = `/games?page_size=${limit}&search=${encodeURIComponent(
      query.trim()
    )}`;
    const data = await fetchData(endpoint);
    return data.results || [];
  } catch (error) {
    console.error("Failed to find the game:", error);
    return [];
  }
}
