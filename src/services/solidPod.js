import {
  getSolidDataset,
  createSolidDataset,
  saveSolidDatasetAt,
  createThing,
  setThing,
  addStringNoLocale,
  addUrl,
  getUrl,
  getThing,
  getThingAll,
  getStringNoLocale,
  getStringNoLocaleAll,
  getUrlAll,
  removeAll,
  removeThing,
} from "@inrupt/solid-client";

// ============================================
// STANDARD URI DEFINITIONS (Schema.org & RDF)
// ============================================
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SCHEMA_PERSON = "https://schema.org/Person";
const SCHEMA_GENRE = "https://schema.org/genre";
const SCHEMA_URL = "https://schema.org/url";
const SCHEMA_BIRTH_DATE = "https://schema.org/birthDate"; 
const SCHEMA_OBJECT = "https://schema.org/object";
const SCHEMA_NAME = "https://schema.org/name";
const SCHEMA_START_TIME = "https://schema.org/startTime";
const SCHEMA_VIEW_ACTION = "https://schema.org/ViewAction";
const SCHEMA_LIKE_ACTION = "https://schema.org/LikeAction";
const SCHEMA_SEARCH_ACTION = "https://schema.org/SearchAction";
const SCHEMA_QUERY = "https://schema.org/query";
const SCHEMA_END_TIME = "https://schema.org/endTime";
const SCHEMA_ITEM = "https://schema.org/item";
const SCHEMA_POSITION = "https://schema.org/position";
const SCHEMA_IDENTIFIER = "https://schema.org/identifier";
const SCHEMA_ITEM_LIST = "https://schema.org/ItemList";
const SCHEMA_ABOUT = "https://schema.org/about";
const SCHEMA_DESCRIPTION = "https://schema.org/description";
const SCHEMA_NUMBER_OF_ITEMS = "https://schema.org/numberOfItems";
const SCHEMA_REVIEW_BODY = "https://schema.org/reviewBody";
const SCHEMA_DATE_PUBLISHED = "https://schema.org/datePublished";
const SCHEMA_VIDEO_GAME = "https://schema.org/VideoGame";
const SCHEMA_LIST_ITEM = "https://schema.org/ListItem";

const APP_NAMESPACE = "game-rec-data";

// ============================================
// HELPER FUNCTIONS
// ============================================
export function getBaseUrlFromWebId(webId) {
  try {
    const url = new URL(webId);
    const profileIndex = url.pathname.indexOf("/profile/");
    return profileIndex !== -1
      ? `${url.origin}${url.pathname.substring(0, profileIndex)}/`
      : `${url.origin}/`;
  } catch (error) {
    throw new Error("Invalid WebID format");
  }
}

// ============================================
// 1. SETTINGS.TTL (Explicit Preferences)
// ============================================
export async function saveSettingsToPod(session, genres, birthDate) {
  const webId = session.info.webId;
  const baseUrl = getBaseUrlFromWebId(webId);
  const settingsUrl = `${baseUrl}public/${APP_NAMESPACE}/settings.ttl`;

  let dataset;
  try {
    dataset = await getSolidDataset(settingsUrl, { fetch: session.fetch });
  } catch {
    dataset = createSolidDataset();
  }

  const userThingUrl = `${settingsUrl}#user-profile`;
  let userThing = createThing({ url: userThingUrl });

  userThing = addUrl(userThing, RDF_TYPE, SCHEMA_PERSON);
  userThing = addStringNoLocale(userThing, SCHEMA_URL, webId);

  // Save Genres
  genres.forEach(genre => {
    userThing = addStringNoLocale(userThing, SCHEMA_GENRE, genre.name);
  });

  // Save Birth Date (Explicit Age Constraint for ESRB filtering)
  if (birthDate) {
    userThing = addStringNoLocale(userThing, SCHEMA_BIRTH_DATE, birthDate);
  }

  dataset = setThing(dataset, userThing);

  try {
    await saveSolidDatasetAt(settingsUrl, dataset, { fetch: session.fetch });
    console.log(
      "Preferences and birthDate saved successfully to:",
      settingsUrl
    );
    return settingsUrl;
  } catch (error) {
    console.error("Failed to save dataset:", error);
    throw new Error(`Failed to save to Solid Pod: ${error.message}`);
  }
}

export async function readSettingsFromPod(webId, fetch) {
  const baseUrl = getBaseUrlFromWebId(webId);
  const settingsUrl = `${baseUrl}public/${APP_NAMESPACE}/settings.ttl`;

  try {
    const dataset = await getSolidDataset(settingsUrl, { fetch });
    const userThing = getThing(dataset, `${settingsUrl}#user-profile`);

    if (!userThing) return null;

    const genres = getStringNoLocaleAll(userThing, SCHEMA_GENRE);
    const birthDate = getStringNoLocale(userThing, SCHEMA_BIRTH_DATE);

    return { genres, birthDate };
  } catch (error) {
    console.warn(
      "Failed to read settings.ttl (may not exist yet):",
      error.message
    );
    return null;
  }
}

export async function updateSettingsGenres(session, newGenres) {
  const webId = session.info.webId;
  const baseUrl = getBaseUrlFromWebId(webId);
  const settingsUrl = `${baseUrl}public/${APP_NAMESPACE}/settings.ttl`;

  let dataset;
  try {
    dataset = await getSolidDataset(settingsUrl, { fetch: session.fetch });
  } catch (error) {
    throw new Error(
      "settings.ttl not found. Please complete onboarding first."
    );
  }

  const userThingUrl = `${settingsUrl}#user-profile`;
  let userThing = getThing(dataset, userThingUrl);

  if (!userThing) {
    throw new Error("User profile not found in settings.ttl");
  }

  // Remove all old genres
  const oldGenres = getStringNoLocaleAll(userThing, SCHEMA_GENRE);
  oldGenres.forEach(genre => {
    userThing = removeAll(userThing, SCHEMA_GENRE, genre);
  });

  // Add new genres
  newGenres.forEach(genre => {
    userThing = addStringNoLocale(userThing, SCHEMA_GENRE, genre);
  });

  dataset = setThing(dataset, userThing);

  try {
    await saveSolidDatasetAt(settingsUrl, dataset, { fetch: session.fetch });
    console.log("Genres updated successfully:", newGenres);
    return newGenres;
  } catch (error) {
    console.error("Failed to update genres:", error);
    throw error;
  }
}

// ============================================
// UPDATE BIRTH DATE IN SETTINGS.TTL
// ============================================
export async function updateSettingsBirthDate(session, newBirthDate) {
  const webId = session.info.webId;
  const baseUrl = getBaseUrlFromWebId(webId);
  const settingsUrl = `${baseUrl}public/${APP_NAMESPACE}/settings.ttl`;

  let dataset;
  try {
    dataset = await getSolidDataset(settingsUrl, { fetch: session.fetch });
  } catch (error) {
    throw new Error(
      "settings.ttl not found. Please complete onboarding first."
    );
  }

  const userThingUrl = `${settingsUrl}#user-profile`;
  let userThing = getThing(dataset, userThingUrl);

  if (!userThing) {
    throw new Error("User profile not found in settings.ttl");
  }

  const oldBirthDate = getStringNoLocale(
    userThing,
    "https://schema.org/birthDate"
  );
  if (oldBirthDate) {
    userThing = removeAll(
      userThing,
      "https://schema.org/birthDate",
      oldBirthDate
    );
  }

  if (newBirthDate) {
    userThing = addStringNoLocale(
      userThing,
      "https://schema.org/birthDate",
      newBirthDate
    );
  }

  dataset = setThing(dataset, userThing);

  try {
    await saveSolidDatasetAt(settingsUrl, dataset, { fetch: session.fetch });
    console.log("Birth date updated successfully:", newBirthDate);
    return newBirthDate;
  } catch (error) {
    console.error("Failed to update birth date:", error);
    throw error;
  }
}

// ============================================
// 2. BEHAVIOR.TTL (Implicit & Explicit Interactions)
// ============================================
export async function saveBehaviorToPod(session, gameId, gameName, actionType) {
  const webId = session.info.webId;
  const baseUrl = getBaseUrlFromWebId(webId);
  const behaviorUrl = `${baseUrl}public/${APP_NAMESPACE}/behavior.ttl`;

  let dataset;
  try {
    dataset = await getSolidDataset(behaviorUrl, { fetch: session.fetch });
  } catch {
    dataset = createSolidDataset();
  }

  const timestamp = Date.now();
  const interactionId = `interaction-${actionType
    .toLowerCase()
    .replace("action", "")}-${timestamp}`;
  const interactionUrl = `${behaviorUrl}#${interactionId}`;

  let interactionThing = createThing({ url: interactionUrl });
  const actionUri =
    actionType === "LikeAction" ? SCHEMA_LIKE_ACTION : SCHEMA_VIEW_ACTION;

  interactionThing = addUrl(interactionThing, RDF_TYPE, actionUri);
  interactionThing = addUrl(
    interactionThing,
    SCHEMA_OBJECT,
    `https://rawg.io/games/${gameId}`
  );
  interactionThing = addStringNoLocale(interactionThing, SCHEMA_NAME, gameName);
  interactionThing = addStringNoLocale(
    interactionThing,
    SCHEMA_START_TIME,
    new Date(timestamp).toISOString()
  );

  dataset = setThing(dataset, interactionThing);

  try {
    await saveSolidDatasetAt(behaviorUrl, dataset, { fetch: session.fetch });
    console.log(`Successfully recorded ${actionType} for "${gameName}"`);
    return behaviorUrl;
  } catch (error) {
    console.error(`Failed to record ${actionType}:`, error);
    throw new Error(`Failed to save behavior: ${error.message}`);
  }
}

export async function readBehaviorFromPod(webId, fetch) {
  const baseUrl = getBaseUrlFromWebId(webId);
  const behaviorUrl = `${baseUrl}public/${APP_NAMESPACE}/behavior.ttl`;

  try {
    const dataset = await getSolidDataset(behaviorUrl, { fetch });
    const allThings = getThingAll(dataset);
    const interactions = [];

    allThings.forEach(thing => {
      const types = getUrlAll(thing, RDF_TYPE);
      const isViewAction = types.includes(SCHEMA_VIEW_ACTION);
      const isLikeAction = types.includes(SCHEMA_LIKE_ACTION);

      if (isViewAction || isLikeAction) {
        const gameUri = getUrl(thing, SCHEMA_OBJECT);
        interactions.push({
          type: isLikeAction ? "LikeAction" : "ViewAction",
          gameId: gameUri ? gameUri.split("/").pop() : null,
          gameName: getStringNoLocale(thing, SCHEMA_NAME),
          timestamp: getStringNoLocale(thing, SCHEMA_START_TIME),
        });
      }
    });

    interactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return interactions;
  } catch (error) {
    console.warn("⚠️ Failed to read behavior.ttl:", error.message);
    return [];
  }
}

export async function removeGameFromPod(session, gameId) {
  const webId = session.info.webId;
  const baseUrl = getBaseUrlFromWebId(webId);
  const behaviorUrl = `${baseUrl}public/${APP_NAMESPACE}/behavior.ttl`;

  let dataset;
  try {
    dataset = await getSolidDataset(behaviorUrl, { fetch: session.fetch });
  } catch (error) {
    throw new Error("behavior.ttl not found.");
  }

  const allThings = getThingAll(dataset);
  const gameUri = `https://rawg.io/games/${gameId}`;
  let removedCount = 0;

  allThings.forEach(thing => {
    if (getUrl(thing, SCHEMA_OBJECT) === gameUri) {
      dataset = removeThing(dataset, thing);
      removedCount++;
    }
  });

  if (removedCount === 0) {
    throw new Error("Game not found in behavior.ttl");
  }

  try {
    await saveSolidDatasetAt(behaviorUrl, dataset, { fetch: session.fetch });
    console.log(
      `✅ Successfully removed ${removedCount} interactions for game ID ${gameId}`
    );
    return removedCount;
  } catch (error) {
    console.error("Failed to remove game:", error);
    throw error;
  }
}

// ============================================
// 3. SESSIONS, SEEDS & RECOMMENDATIONS
// ============================================
export async function saveSessionToPod(
  session,
  sessionId,
  vibeQuery,
  genres,
  seedGameIds
) {
  const webId = session.info.webId;
  const baseUrl = getBaseUrlFromWebId(webId);
  const sessionsUrl = `${baseUrl}public/${APP_NAMESPACE}/sessions.ttl`;

  let dataset;
  try {
    dataset = await getSolidDataset(sessionsUrl, { fetch: session.fetch });
  } catch {
    dataset = createSolidDataset();
  }

  const sessionUrl = `${sessionsUrl}#${sessionId}`;
  let sessionThing = createThing({ url: sessionUrl });

  sessionThing = addUrl(sessionThing, RDF_TYPE, SCHEMA_SEARCH_ACTION);
  sessionThing = addStringNoLocale(sessionThing, SCHEMA_QUERY, vibeQuery);
  sessionThing = addStringNoLocale(
    sessionThing,
    SCHEMA_END_TIME,
    new Date().toISOString()
  );

  genres.forEach(
    g => (sessionThing = addStringNoLocale(sessionThing, SCHEMA_GENRE, g))
  );
  seedGameIds.forEach((gameId, idx) => {
    sessionThing = addUrl(
      sessionThing,
      SCHEMA_OBJECT,
      `${baseUrl}public/${APP_NAMESPACE}/seeds.ttl#seed-${sessionId}-${idx}`
    );
  });

  dataset = setThing(dataset, sessionThing);

  try {
    await saveSolidDatasetAt(sessionsUrl, dataset, { fetch: session.fetch });
    return sessionsUrl;
  } catch (error) {
    console.error("Failed to save session:", error);
    throw error;
  }
}

export async function saveSeedsToPod(session, sessionId, seedGames) {
  const webId = session.info.webId;
  const baseUrl = getBaseUrlFromWebId(webId);
  const seedsUrl = `${baseUrl}public/${APP_NAMESPACE}/seeds.ttl`;

  let dataset;
  try {
    dataset = await getSolidDataset(seedsUrl, { fetch: session.fetch });
  } catch {
    dataset = createSolidDataset();
  }

  seedGames.forEach((game, idx) => {
    const gameUrl = `${seedsUrl}#game-${game.id}`;
    let gameThing = createThing({ url: gameUrl });

    gameThing = addUrl(gameThing, RDF_TYPE, SCHEMA_VIDEO_GAME);
    gameThing = addStringNoLocale(gameThing, SCHEMA_NAME, game.name);
    gameThing = addStringNoLocale(
      gameThing,
      SCHEMA_IDENTIFIER,
      String(game.id)
    );
    if (game.released)
      gameThing = addStringNoLocale(
        gameThing,
        SCHEMA_DATE_PUBLISHED,
        game.released
      );
    dataset = setThing(dataset, gameThing);

    const listItemUrl = `${seedsUrl}#seed-${sessionId}-${idx}`;
    let listItemThing = createThing({ url: listItemUrl });
    listItemThing = addUrl(listItemThing, RDF_TYPE, SCHEMA_LIST_ITEM);
    listItemThing = addUrl(listItemThing, SCHEMA_ITEM, gameUrl);
    listItemThing = addStringNoLocale(
      listItemThing,
      SCHEMA_POSITION,
      String(idx + 1)
    );
    listItemThing = addStringNoLocale(
      listItemThing,
      SCHEMA_IDENTIFIER,
      sessionId
    );
    dataset = setThing(dataset, listItemThing);
  });

  try {
    await saveSolidDatasetAt(seedsUrl, dataset, { fetch: session.fetch });
    return seedsUrl;
  } catch (error) {
    console.error("Failed to save seeds:", error);
    throw error;
  }
}

export async function saveRecommendationsToPod(
  session,
  sessionId,
  vibeQuery,
  recommendations
) {
  const webId = session.info.webId;
  const baseUrl = getBaseUrlFromWebId(webId);
  const recsUrl = `${baseUrl}public/${APP_NAMESPACE}/recommendations.ttl`;

  let dataset;
  try {
    dataset = await getSolidDataset(recsUrl, { fetch: session.fetch });
  } catch {
    dataset = createSolidDataset();
  }

  const listUrl = `${recsUrl}#recommendation-${sessionId}`;
  let listThing = createThing({ url: listUrl });

  listThing = addUrl(listThing, RDF_TYPE, SCHEMA_ITEM_LIST);
  listThing = addStringNoLocale(
    listThing,
    SCHEMA_NAME,
    `GamePod List ${sessionId}`
  );
  listThing = addStringNoLocale(listThing, SCHEMA_DESCRIPTION, vibeQuery);
  listThing = addStringNoLocale(
    listThing,
    SCHEMA_NUMBER_OF_ITEMS,
    String(recommendations.length)
  );
  listThing = addUrl(
    listThing,
    SCHEMA_ABOUT,
    `${baseUrl}public/${APP_NAMESPACE}/sessions.ttl#${sessionId}`
  );
  dataset = setThing(dataset, listThing);

  recommendations.forEach((rec, idx) => {
    const itemUrl = `${recsUrl}#item-${sessionId}-${idx}`;
    let itemThing = createThing({ url: itemUrl });

    itemThing = addUrl(itemThing, RDF_TYPE, SCHEMA_LIST_ITEM);
    itemThing = addUrl(itemThing, SCHEMA_ITEM, `${recsUrl}#game-${rec.rawgId}`);
    itemThing = addStringNoLocale(itemThing, SCHEMA_POSITION, String(idx + 1));
    if (rec.reviewBody)
      itemThing = addStringNoLocale(
        itemThing,
        SCHEMA_REVIEW_BODY,
        rec.reviewBody
      );
    dataset = setThing(dataset, itemThing);

    const gameUrl = `${recsUrl}#game-${rec.rawgId}`;
    let gameThing = createThing({ url: gameUrl });
    gameThing = addUrl(gameThing, RDF_TYPE, SCHEMA_VIDEO_GAME);
    gameThing = addStringNoLocale(gameThing, SCHEMA_NAME, rec.name);
    gameThing = addStringNoLocale(
      gameThing,
      SCHEMA_IDENTIFIER,
      String(rec.rawgId)
    );
    dataset = setThing(dataset, gameThing);
  });

  try {
    await saveSolidDatasetAt(recsUrl, dataset, { fetch: session.fetch });
    return recsUrl;
  } catch (error) {
    console.error("Failed to save recommendations:", error);
    throw error;
  }
}

export async function readRecommendationsFromPod(webId, fetch) {
  const baseUrl = getBaseUrlFromWebId(webId);
  const recsUrl = `${baseUrl}public/${APP_NAMESPACE}/recommendations.ttl`;

  try {
    const dataset = await getSolidDataset(recsUrl, { fetch });
    const allThings = getThingAll(dataset);

    const lists = allThings.filter(t =>
      getUrlAll(t, RDF_TYPE).includes(SCHEMA_ITEM_LIST)
    );
    if (lists.length === 0) return null;

    const latestList = lists[lists.length - 1];
    const items = allThings.filter(t =>
      getUrlAll(t, RDF_TYPE).includes(SCHEMA_LIST_ITEM)
    );
    const recommendations = [];

    for (const item of items) {
      const gameRef = getUrl(item, SCHEMA_ITEM);
      if (gameRef) {
        const gameThing = allThings.find(t => getUrl(t) === gameRef);
        recommendations.push({
          rawgId: gameThing
            ? parseInt(getStringNoLocale(gameThing, SCHEMA_IDENTIFIER))
            : null,
          name: gameThing
            ? getStringNoLocale(gameThing, SCHEMA_NAME)
            : "Unknown",
          reviewBody: getStringNoLocale(item, SCHEMA_REVIEW_BODY) || "",
          position: parseInt(getStringNoLocale(item, SCHEMA_POSITION)) || 0,
        });
      }
    }

    recommendations.sort((a, b) => a.position - b.position);
    return {
      description: getStringNoLocale(latestList, SCHEMA_DESCRIPTION),
      recommendations,
    };
  } catch (error) {
    console.warn("No recommendations saved yet:", error.message);
    return null;
  }
}

// ============================================
// 4. ADVANCED FEATURES (Auto-Rec & KG Analysis)
// ============================================

export async function generateAutoRecommendations(session) {
  const webId = session.info.webId;

  const [settings, behavior] = await Promise.all([
    readSettingsFromPod(webId, session.fetch),
    readBehaviorFromPod(webId, session.fetch),
  ]);

  const likedGames = behavior.filter(b => b.type === "LikeAction").slice(0, 3);
  const genres = settings?.genres || [];
  const gameNames = likedGames
    .map(g => g.gameName)
    .filter(Boolean)
    .join(" and ");

  let autoVibeQuery = "Recommend high-quality, diverse popular games.";
  if (genres.length > 0 && gameNames) {
    autoVibeQuery = `Recommend games similar to "${gameNames}" and matching my favorite genres: ${genres.join(
      ", "
    )}.`;
  } else if (gameNames) {
    autoVibeQuery = `Recommend games similar to "${gameNames}".`;
  } else if (genres.length > 0) {
    autoVibeQuery = `Recommend the best games in these genres: ${genres.join(
      ", "
    )}.`;
  }

  console.log("🤖 Auto-generated Vibe Query:", autoVibeQuery);

  const { fetchCandidateGames } = await import("../services/rawgApi");
  const { generateRecommendations } = await import("../services/openRouter");

  const candidates = await fetchCandidateGames(genres, "", 40);
  if (candidates.length === 0)
    throw new Error("No candidate games found in the database.");

  const context = {
    preferredGenres: genres,
    seedGames: likedGames.map(g => ({ name: g.gameName, genres: [] })),
    recentBehavior: behavior,
    vibeQuery: autoVibeQuery,
  };

  const llmResult = await generateRecommendations(context, candidates);
  if (!llmResult.recommendations || llmResult.recommendations.length === 0) {
    throw new Error("AI could not generate recommendations. Please try again.");
  }

  const enrichedRecs = await Promise.all(
    llmResult.recommendations.map(async rec => {
      try {
        const { fetchGameDetail } = await import("../services/rawgApi");
        return { ...rec, rawData: await fetchGameDetail(rec.rawgId) };
      } catch {
        return { ...rec, rawData: null };
      }
    })
  );

  const sessionId = `auto-session-${Date.now()}`;
  const { saveSessionToPod, saveRecommendationsToPod } = await import(
    "../services/solidPod"
  );

  await Promise.all([
    saveSessionToPod(
      session,
      sessionId,
      autoVibeQuery,
      genres,
      likedGames.map(g => g.gameId).filter(Boolean)
    ),
    saveRecommendationsToPod(session, sessionId, autoVibeQuery, enrichedRecs),
  ]);

  return {
    recommendations: enrichedRecs,
    reasoning: llmResult.reasoning,
    autoQuery: autoVibeQuery,
  };
}

export async function analyzeUserPreferences(webId, fetch) {
  const [settings, behavior] = await Promise.all([
    readSettingsFromPod(webId, fetch),
    readBehaviorFromPod(webId, fetch),
  ]);

  let recentSessions = [];
  try {
    const baseUrl = webId.split("/profile/")[0] + "/";
    const sessionsUrl = `${baseUrl}public/game-rec-data/sessions.ttl`;
    const sessionDataset = await getSolidDataset(sessionsUrl, { fetch });
    const allSessionThings = getThingAll(sessionDataset);
    recentSessions = allSessionThings
      .filter(t =>
        getUrlAll(
          t,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
        ).includes("https://schema.org/SearchAction")
      )
      .map(t => getStringNoLocale(t, "https://schema.org/query"))
      .filter(Boolean)
      .slice(-3);
  } catch (err) {
    // Ignore if sessions.ttl doesn't exist
  }

  if (behavior.length === 0 && recentSessions.length === 0) {
    return {
      totalInteractions: 0,
      likedCount: 0,
      viewedCount: 0,
      genreAnalysis: [],
      publisherAnalysis: [],
      developerAnalysis: [],
      platformAnalysis: [],
      yearAnalysis: [],
      ratingAnalysis: [],
      explainableText:
        "You do not have enough interaction history yet. Start exploring, searching, and saving games you like to generate a detailed preference analysis.",
    };
  }

  const recentLikedInteractions = behavior
    .filter(b => b.type === "LikeAction")
    .slice(0, 15);
  const uniqueGameIds = [
    ...new Set(recentLikedInteractions.map(b => b.gameId)),
  ];

  const gameDetails = await Promise.all(
    uniqueGameIds.map(async gameId => {
      try {
        const { fetchGameDetail } = await import("../services/rawgApi");
        const detail = await fetchGameDetail(gameId);
        return {
          gameId,
          name: detail.name,
          genres: (detail.genres || []).map(g => g.name),
          publishers: (detail.publishers || []).map(p => p.name),
          developers: (detail.developers || []).map(d => d.name),
          platforms: (detail.platforms || [])
            .map(p => p.platform?.name)
            .filter(Boolean),
          releaseYear: detail.released
            ? new Date(detail.released).getFullYear()
            : null,
          rating: detail.rating || 0,
        };
      } catch {
        return null;
      }
    })
  );

  const validGames = gameDetails.filter(g => g !== null);
  const genreFreq = {};
  const publisherFreq = {};
  const developerFreq = {};
  const platformFreq = {};
  const yearFreq = {};
  const ratingBuckets = { "1-2": 0, "2-3": 0, "3-4": 0, "4-5": 0 };

  recentLikedInteractions.forEach(interaction => {
    const game = validGames.find(g => g.gameId === interaction.gameId);
    if (!game) return;

    game.genres.forEach(g => {
      genreFreq[g] = (genreFreq[g] || 0) + 1;
    });
    game.publishers.forEach(p => {
      publisherFreq[p] = (publisherFreq[p] || 0) + 1;
    });
    game.developers.forEach(d => {
      developerFreq[d] = (developerFreq[d] || 0) + 1;
    });
    game.platforms.forEach(p => {
      platformFreq[p] = (platformFreq[p] || 0) + 1;
    });

    if (game.releaseYear)
      yearFreq[game.releaseYear] = (yearFreq[game.releaseYear] || 0) + 1;

    if (game.rating > 0) {
      if (game.rating < 2) ratingBuckets["1-2"]++;
      else if (game.rating < 3) ratingBuckets["2-3"]++;
      else if (game.rating < 4) ratingBuckets["3-4"]++;
      else ratingBuckets["4-5"]++;
    }
  });

  const genreAnalysis = Object.entries(genreFreq)
    .map(([name, count]) => ({ name, total: count, liked: count, viewed: 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const publisherAnalysis = Object.entries(publisherFreq)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const developerAnalysis = Object.entries(developerFreq)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const platformAnalysis = Object.entries(platformFreq)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const yearAnalysis = Object.entries(yearFreq)
    .map(([year, count]) => ({ year: parseInt(year), count }))
    .sort((a, b) => a.year - b.year);
  const ratingAnalysis = Object.entries(ratingBuckets).map(
    ([range, count]) => ({ range, count })
  );

  // =========================================================
  // GENERATE ELABORATIVE EXPLAINABLE TEXT
  // =========================================================
  const gameCount = recentLikedInteractions.length;
  const gameLabel = gameCount === 1 ? "game" : "games";

  let explainableText = "";

  // 1. Opening statement
  explainableText += `Based on the Knowledge Graph analysis of your Solid Pod from your **${gameCount}** recently saved ${gameLabel}, `;

  // 2. Genre preferences (more elaborative)
  if (genreAnalysis.length > 0) {
    const topGenres = genreAnalysis.slice(0, 2);
    if (topGenres.length === 1) {
      explainableText += `you demonstrate a strong and consistent preference for the **${topGenres[0].name}** genre. This suggests you gravitate toward specific gameplay mechanics and narrative styles that define this category. `;
    } else if (topGenres.length === 2) {
      explainableText += `you demonstrate strong preferences for the **${
        topGenres[0].name
      }** and **${
        topGenres[1].name
      }** genres, showing a diverse yet focused taste in gaming. This combination indicates you appreciate both ${topGenres[0].name.toLowerCase()} experiences and ${topGenres[1].name.toLowerCase()} elements in your games. `;
    } else {
      const genreNames = topGenres.map(g => `**${g.name}**`).join(", ");
      explainableText += `you show appreciation for multiple genres including ${genreNames}, reflecting a well-rounded gaming palate. `;
    }
  }

  // 3. Developer/Publisher preferences
  if (developerAnalysis.length > 0 && publisherAnalysis.length > 0) {
    explainableText += `Your interactions reveal a clear affinity for titles developed by **${developerAnalysis[0].name}** and published by **${publisherAnalysis[0].name}**, suggesting you appreciate their distinctive design philosophy and quality standards. `;
  } else if (developerAnalysis.length > 0) {
    explainableText += `You show a distinct preference for games developed by **${developerAnalysis[0].name}**, indicating loyalty to their creative vision and consistent enjoyment of their craftsmanship. `;
  } else if (publisherAnalysis.length > 0) {
    explainableText += `You tend to favor games published by **${publisherAnalysis[0].name}**, reflecting trust in their curation and the quality of titles they bring to market. `;
  }

  // 4. Platform preference
  if (platformAnalysis.length > 0) {
    const topPlatform = platformAnalysis[0].name;
    if (platformAnalysis.length > 1) {
      explainableText += `Furthermore, your gameplay is primarily centered around the **${topPlatform}** platform, though you also engage with ${platformAnalysis[1].name}, indicating a flexible approach to gaming environments. `;
    } else {
      explainableText += `Furthermore, your gameplay is primarily centered around the **${topPlatform}** platform, which serves as your preferred gaming environment and shapes your accessibility preferences. `;
    }
  }

  // 5. Year/Era preference
  if (yearAnalysis.length > 0) {
    const recentYears = yearAnalysis.filter(y => y.year >= 2020);
    if (recentYears.length > 0) {
      const totalRecent = recentYears.reduce((sum, y) => sum + y.count, 0);
      const percentage = Math.round((totalRecent / gameCount) * 100);
      explainableText += `You also demonstrate a clear preference for modern releases from **2020 onwards** (${percentage}% of your saved games), staying current with contemporary gaming trends, graphics, and mechanics. `;
    } else {
      const topYear = yearAnalysis.reduce((a, b) =>
        a.count > b.count ? a : b
      );
      explainableText += `Interestingly, you have a notable appreciation for classics released around **${topYear.year}**, suggesting a taste for timeless gaming experiences that have stood the test of time. `;
    }
  }

  // 6. Rating patterns (more elaborative)
  const highRated = ratingBuckets["4-5"];
  const midRated = ratingBuckets["3-4"];
  const lowRated = ratingBuckets["1-2"] + ratingBuckets["2-3"];

  if (highRated > gameCount * 0.6) {
    const percentage = Math.round((highRated / gameCount) * 100);
    explainableText += `Finally, your rating patterns indicate you are **highly selective**, with **${percentage}%** of your saved games rated **4 to 5 stars**. You prioritize quality over quantity, consistently favoring top-tier experiences that deliver exceptional gameplay, storytelling, or innovation.`;
  } else if (highRated > gameCount * 0.3) {
    explainableText += `Your rating patterns show you have a **diverse and balanced taste**, enjoying a mix of both critically acclaimed titles (4-5 stars) and hidden gems across the quality spectrum. You appreciate games for various merits, not just mainstream popularity.`;
  } else if (midRated > gameCount * 0.4) {
    explainableText += `Your rating patterns suggest you are an **exploratory gamer**, often trying games in the **3-4 star** range. You value discovery and are willing to give lesser-known titles a chance, finding enjoyment in unique experiences beyond the mainstream.`;
  } else {
    explainableText += `Your rating patterns indicate an **eclectic and adventurous** approach to gaming, with interests spanning across various quality levels. You likely enjoy discovering hidden gems and niche titles that cater to specific interests.`;
  }

  // 7. Recent searches (without age filter - handled in Home)
  if (recentSessions.length > 0) {
    explainableText += `\n\n*Recent exploratory searches indicate active interest in: ${recentSessions.join(
      ", "
    )}.*`;
  }

  return {
    totalInteractions: behavior.length,
    likedCount: gameCount,
    viewedCount: behavior.filter(b => b.type === "ViewAction").length,
    genreAnalysis,
    publisherAnalysis,
    developerAnalysis,
    platformAnalysis,
    yearAnalysis,
    ratingAnalysis,
    explainableText,
  };
}
