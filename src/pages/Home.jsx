import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { getDefaultSession } from "@inrupt/solid-client-authn-browser";
import { fetchGames } from "../services/rawgApi";
import { readSettingsFromPod, readBehaviorFromPod } from "../services/solidPod";
import GameCard from "../components/GameCard";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  Shield,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Loader2,
  AlertCircle,
  Brain,
  Tag,
  Building2,
  Code2,
  Monitor,
  Star,
  Calendar,
  GitBranch,
} from "lucide-react";

// =========================================================
// KNOWLEDGE GRAPH SCORING CONSTANTS
// =========================================================
const KG_WEIGHTS = {
  LIKE_ACTION: 1.0,
  VIEW_ACTION: 0.3,
  GENRE_MATCH: 0.4,
  PUBLISHER_MATCH: 0.6,
  DEVELOPER_MATCH: 0.7,
  PLATFORM_MATCH: 0.3,
  RATING_BONUS: 0.2,
  RECENCY_BONUS: 0.15,
};

const RECENCY_THRESHOLD_DAYS = 30;

// =========================================================
// HELPER FUNCTIONS
// =========================================================

const getAgeCategoryLabel = allowedIds => {
  if (allowedIds.includes(5)) return "Adults Only (18+)";
  if (allowedIds.includes(4)) return "Mature (17+)";
  if (allowedIds.includes(3)) return "Teen (13+)";
  if (allowedIds.includes(2)) return "Everyone 10+";
  return "Everyone (E)";
};

const getAllowedEsrbIds = birthDate => {
  if (!birthDate) return [1, 2, 3, 4, 5];

  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  if (age < 10) return [1, 2];
  if (age < 13) return [1, 2];
  if (age < 17) return [1, 2, 3];
  if (age < 18) return [1, 2, 3, 4];
  return [1, 2, 3, 4, 5];
};

const isAgeAppropriate = (game, allowedIds) => {
  if (
    !game.esrb_rating ||
    game.esrb_rating.id === null ||
    game.esrb_rating.id === undefined
  ) {
    const isAdult = allowedIds.includes(4) || allowedIds.includes(5);
    return isAdult;
  }
  const gameId = Number(game.esrb_rating.id);
  return allowedIds.includes(gameId);
};

const enforceDiversity = (games, maxPerEntity = 2) => {
  const publisherCount = {};
  const developerCount = {};
  const diverseGames = [];

  for (const game of games) {
    const pub = game.publishers?.[0]?.name;
    const dev = game.developers?.[0]?.name;

    let isPruned = false;

    if (pub && pub.trim() !== "") {
      publisherCount[pub] = (publisherCount[pub] || 0) + 1;
      if (publisherCount[pub] > maxPerEntity) isPruned = true;
    }

    if (!isPruned && dev && dev.trim() !== "") {
      developerCount[dev] = (developerCount[dev] || 0) + 1;
      if (developerCount[dev] > maxPerEntity) isPruned = true;
    }

    if (!isPruned) {
      diverseGames.push(game);
    }
  }
  return diverseGames;
};

const getPlatformIdByName = name => {
  const map = {
    PC: 4,
    "PlayStation 5": 187,
    "PlayStation 4": 18,
    "Xbox Series X": 186,
    "Xbox One": 1,
    "Nintendo Switch": 7,
    iOS: 3,
    Android: 21,
  };
  return map[name] || null;
};

// =========================================================
// MAIN COMPONENT
// =========================================================
export default function Home() {
  const [searchParams] = useSearchParams();
  const session = getDefaultSession();

  const [games, setGames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [explicitGenres, setExplicitGenres] = useState([]);
  const [personalizedGameIds, setPersonalizedGameIds] = useState(new Set());
  const [combinedGamesCache, setCombinedGamesCache] = useState([]);
  const [savedGameIds, setSavedGameIds] = useState(new Set());
  const [isPersonalizationReady, setIsPersonalizationReady] = useState(false);

  const [allowedEsrbIds, setAllowedEsrbIds] = useState([1, 2, 3, 4, 5]);
  const [kgInsights, setKgInsights] = useState([]);
  const [kgStats, setKgStats] = useState({
    totalNodes: 0,
    totalEdges: 0,
    reasoningDepth: 3,
  });

  const currentSearch = searchParams.get("search") || "";
  const currentGenre = searchParams.get("genre") || "";
  const currentOrdering = searchParams.get("ordering") || "-rating";
  const hasActiveFilters =
    currentSearch || currentGenre || currentOrdering !== "-rating";

  useEffect(() => {
    setCurrentPage(1);
  }, [currentSearch, currentGenre, currentOrdering]);

  useEffect(() => {
    async function buildKnowledgeGraph() {
      if (session.info.isLoggedIn && session.info.webId) {
        try {
          const [settings, behavior] = await Promise.all([
            readSettingsFromPod(session.info.webId, session.fetch),
            readBehaviorFromPod(session.info.webId, session.fetch),
          ]);

          const currentExplicit = settings?.genres || [];
          const birthDate = settings?.birthDate || null;

          setExplicitGenres(currentExplicit);

          const calculatedEsrb = getAllowedEsrbIds(birthDate);
          setAllowedEsrbIds(calculatedEsrb);

          console.log("🔍 DIAGNOSTIC - Birth Date Read:", birthDate);
          console.log(
            "🔍 DIAGNOSTIC - Calculated ESRB IDs (Local):",
            calculatedEsrb
          );

          const allInteractions = behavior || []; 
          const likedGames = allInteractions.filter(
            b => b.type === "LikeAction"
          );
          const viewedGames = allInteractions.filter(
            b => b.type === "ViewAction"
          );
          const freshSavedIds = new Set(likedGames.map(b => String(b.gameId)));
          setSavedGameIds(freshSavedIds);

          const uniqueGameIds = [
            ...new Set([
              ...likedGames.slice(0, 15).map(b => b.gameId),
              ...viewedGames.slice(0, 10).map(b => b.gameId),
            ]),
          ];

          const gameMetadataMap = {};
          await Promise.all(
            uniqueGameIds.map(async gameId => {
              try {
                const { fetchGameDetail } = await import("../services/rawgApi");
                gameMetadataMap[gameId] = await fetchGameDetail(gameId);
              } catch {
                /* skip */
              }
            })
          );

          const now = Date.now();
          const genreScores = {},
            publisherScores = {},
            developerScores = {},
            platformScores = {};
          const ratingSum = { total: 0, count: 0 };
          const yearScores = {};

          const processInteraction = (interaction, weight) => {
            const game = gameMetadataMap[interaction.gameId];
            if (!game) return;

            const daysAgo =
              (now - new Date(interaction.timestamp).getTime()) /
              (1000 * 60 * 60 * 24);
            const recencyMultiplier =
              daysAgo < RECENCY_THRESHOLD_DAYS
                ? 1 + KG_WEIGHTS.RECENCY_BONUS
                : 1;
            const effectiveWeight = weight * recencyMultiplier;

            (game.genres || []).forEach(g => {
              genreScores[g.name] =
                (genreScores[g.name] || 0) + effectiveWeight;
            });
            (game.publishers || []).forEach(p => {
              publisherScores[p.name] =
                (publisherScores[p.name] || 0) + effectiveWeight;
            });
            (game.developers || []).forEach(d => {
              developerScores[d.name] =
                (developerScores[d.name] || 0) + effectiveWeight;
            });
            (game.platforms || []).forEach(p => {
              if (p.platform?.name)
                platformScores[p.platform.name] =
                  (platformScores[p.platform.name] || 0) + effectiveWeight;
            });

            if (game.rating > 0) {
              ratingSum.total += game.rating * effectiveWeight;
              ratingSum.count += effectiveWeight;
            }
            if (game.released) {
              const year = new Date(game.released).getFullYear();
              yearScores[year] = (yearScores[year] || 0) + effectiveWeight;
            }
          };

          likedGames.forEach(i =>
            processInteraction(i, KG_WEIGHTS.LIKE_ACTION)
          );
          viewedGames.forEach(i =>
            processInteraction(i, KG_WEIGHTS.VIEW_ACTION)
          );

          const topGenres = Object.entries(genreScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, score]) => ({ name, score: score.toFixed(2) }));
          const topPublishers = Object.entries(publisherScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([name, score]) => ({ name, score: score.toFixed(2) }));
          const topDevelopers = Object.entries(developerScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([name, score]) => ({ name, score: score.toFixed(2) }));
          const topPlatforms = Object.entries(platformScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([name, score]) => ({ name, score: score.toFixed(2) }));
          const avgRating =
            ratingSum.count > 0
              ? (ratingSum.total / ratingSum.count).toFixed(1)
              : null;
          const topYears = Object.entries(yearScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 1)
            .map(([year]) => parseInt(year));

          const insights = [];
          if (topGenres.length > 0)
            insights.push({
              icon: <Tag size={14} />,
              label: `Genres: ${topGenres.map(g => g.name).join(", ")}`,
              detail: `Score: ${topGenres[0].score}`,
            });
          if (topPublishers.length > 0)
            insights.push({
              icon: <Building2 size={14} />,
              label: `Publisher: ${topPublishers[0].name}`,
              detail: `Score: ${topPublishers[0].score}`,
            });
          if (topDevelopers.length > 0)
            insights.push({
              icon: <Code2 size={14} />,
              label: `Developer: ${topDevelopers[0].name}`,
              detail: `Score: ${topDevelopers[0].score}`,
            });
          if (topPlatforms.length > 0)
            insights.push({
              icon: <Monitor size={14} />,
              label: `Platform: ${topPlatforms[0].name}`,
              detail: `Score: ${topPlatforms[0].score}`,
            });
          if (avgRating)
            insights.push({
              icon: <Star size={14} />,
              label: `Avg Rating Preference: ${avgRating}★`,
              detail: "High-quality preference detected",
            });
          if (topYears.length > 0)
            insights.push({
              icon: <Calendar size={14} />,
              label: `Era: ${topYears[0]}s`,
              detail: "Temporal preference detected",
            });

          setKgInsights(insights);

          const totalNodes =
            uniqueGameIds.length +
            topGenres.length +
            topPublishers.length +
            topDevelopers.length +
            topPlatforms.length;
          const totalEdges =
            likedGames.length +
            viewedGames.length +
            Object.values(genreScores).length +
            Object.values(publisherScores).length +
            Object.values(developerScores).length +
            Object.values(platformScores).length;
          setKgStats({ totalNodes, totalEdges, reasoningDepth: 3 });

          let allPersonalizedGames = [];
          const seenIds = new Set();

          const addGameWithReason = (game, reason, score) => {
            if (!isAgeAppropriate(game, calculatedEsrb)) return;

            if (!seenIds.has(game.id) && !freshSavedIds.has(String(game.id))) {
              allPersonalizedGames.push({
                ...game,
                kgReason: reason,
                kgScore: score,
              });
              seenIds.add(game.id);
            }
          };

          const combinedGenres = [
            ...new Set([...currentExplicit, ...topGenres.map(g => g.name)]),
          ].slice(0, 3);
          if (combinedGenres.length > 0) {
            try {
              const data = await fetchGames(1, "", {
                genres: combinedGenres,
                esrbRatings: calculatedEsrb,
                ordering: "-rating",
                pageSize: 40,
              });
              (data.results || []).forEach(g =>
                addGameWithReason(
                  g,
                  `Aligns with your preferred genre: ${combinedGenres[0]}`,
                  KG_WEIGHTS.GENRE_MATCH
                )
              );
            } catch (err) {
              console.warn("KG Hop 1 failed:", err);
            }
          }

          if (topPublishers.length > 0 && allPersonalizedGames.length < 40) {
            try {
              const data = await fetchGames(1, topPublishers[0].name, {
                esrbRatings: calculatedEsrb,
                ordering: "-rating",
                pageSize: 30,
              });
              (data.results || []).forEach(g =>
                addGameWithReason(
                  g,
                  `From your favored publisher: ${topPublishers[0].name}`,
                  KG_WEIGHTS.PUBLISHER_MATCH
                )
              );
            } catch (err) {
              console.warn("KG Hop 2 failed:", err);
            }
          }

          if (topDevelopers.length > 0 && allPersonalizedGames.length < 50) {
            try {
              const data = await fetchGames(1, topDevelopers[0].name, {
                esrbRatings: calculatedEsrb,
                ordering: "-rating",
                pageSize: 30,
              });
              (data.results || []).forEach(g =>
                addGameWithReason(
                  g,
                  `Crafted by your preferred developer: ${topDevelopers[0].name}`,
                  KG_WEIGHTS.DEVELOPER_MATCH
                )
              );
            } catch (err) {
              console.warn("KG Hop 3 failed:", err);
            }
          }

          if (topPlatforms.length > 0 && allPersonalizedGames.length < 60) {
            const platformId = getPlatformIdByName(topPlatforms[0].name);
            if (platformId) {
              try {
                const data = await fetchGames(1, "", {
                  platforms: [platformId],
                  esrbRatings: calculatedEsrb,
                  ordering: "-rating",
                  pageSize: 30,
                });
                (data.results || []).forEach(g =>
                  addGameWithReason(
                    g,
                    `Optimized for your platform: ${topPlatforms[0].name}`,
                    KG_WEIGHTS.PLATFORM_MATCH
                  )
                );
              } catch (err) {
                console.warn("KG Hop 4 failed:", err);
              }
            }
          }

          allPersonalizedGames.forEach(game => {
            const ratingBonus =
              (game.rating || 0) >= 4 ? KG_WEIGHTS.RATING_BONUS : 0;
            game.finalScore = (game.kgScore || 0) + ratingBonus;
          });

          allPersonalizedGames.sort((a, b) => b.finalScore - a.finalScore);

          const diverseGames = enforceDiversity(allPersonalizedGames, 2);

          setCombinedGamesCache(diverseGames.slice(0, 60));
          setPersonalizedGameIds(new Set(diverseGames.map(g => g.id)));

          console.log(
            `✅ KG Recommendation Complete: ${
              diverseGames.length
            } diverse games ranked (Strictly filtered for ESRB: ${calculatedEsrb.join(
              ","
            )})`
          );
        } catch (err) {
          console.warn("Failed to build Knowledge Graph:", err);
        }
      }
      setIsPersonalizationReady(true);
    }
    buildKnowledgeGraph();
  }, [session.info.isLoggedIn, session.info.webId]);

  useEffect(() => {
    if (!isPersonalizationReady) return;
    loadGames();
  }, [
    currentPage,
    currentSearch,
    currentGenre,
    currentOrdering,
    isPersonalizationReady,
    combinedGamesCache,
    savedGameIds,
    allowedEsrbIds,
  ]);

  async function loadGames() {
    setIsLoading(true);
    setError(null);

    try {
      if (currentSearch) {
        const data = await fetchGames(currentPage, currentSearch, {
          ordering: currentOrdering,
          genres: currentGenre ? [currentGenre] : [],
          esrbRatings: allowedEsrbIds,
        });
        const safeGames = (data.results || []).filter(g =>
          isAgeAppropriate(g, allowedEsrbIds)
        );
        setGames(safeGames);
        setTotalPages(Math.max(1, Math.ceil(data.count / 20)));
      } else if (currentGenre || currentOrdering !== "-rating") {
        const data = await fetchGames(currentPage, "", {
          ordering: currentOrdering,
          genres: currentGenre ? [currentGenre] : [],
          esrbRatings: allowedEsrbIds,
        });
        const safeGames = (data.results || []).filter(
          g =>
            isAgeAppropriate(g, allowedEsrbIds) &&
            !savedGameIds.has(String(g.id))
        );
        setGames(safeGames);
        setTotalPages(Math.max(1, Math.ceil(data.count / 20)));
      } else if (combinedGamesCache.length > 0) {
        const personalizedPages = Math.ceil(combinedGamesCache.length / 20);

        if (currentPage <= personalizedPages) {
          const start = (currentPage - 1) * 20;
          setGames(combinedGamesCache.slice(start, start + 20));

          if (!window._rawgTotalCount) {
            try {
              const sample = await fetchGames(1, "", {
                ordering: "-rating",
                pageSize: 1,
                esrbRatings: allowedEsrbIds,
              });
              window._rawgTotalCount = sample.count || 900000;
            } catch {
              window._rawgTotalCount = 900000;
            }
          }
          const remainingApiGames = Math.max(
            0,
            window._rawgTotalCount - combinedGamesCache.length
          );
          const apiPages = Math.ceil(remainingApiGames / 20);
          setTotalPages(personalizedPages + apiPages);
        } else {
          const apiPage = currentPage - personalizedPages;
          const data = await fetchGames(apiPage, "", {
            ordering: "-rating",
            pageSize: 40,
            esrbRatings: allowedEsrbIds,
          });

          const safeFiltered = (data.results || []).filter(
            g =>
              isAgeAppropriate(g, allowedEsrbIds) &&
              !savedGameIds.has(String(g.id)) &&
              !personalizedGameIds.has(g.id)
          );

          if (safeFiltered.length < 20 && apiPage < 10) {
            const nextData = await fetchGames(apiPage + 1, "", {
              ordering: "-rating",
              pageSize: 40,
              esrbRatings: allowedEsrbIds,
            });
            const moreSafe = (nextData.results || []).filter(
              g =>
                isAgeAppropriate(g, allowedEsrbIds) &&
                !savedGameIds.has(String(g.id)) &&
                !personalizedGameIds.has(g.id)
            );
            setGames([...safeFiltered, ...moreSafe].slice(0, 20));
          } else {
            setGames(safeFiltered.slice(0, 20));
          }

          const remainingApiGames = Math.max(
            0,
            window._rawgTotalCount - combinedGamesCache.length
          );
          const apiPages = Math.ceil(remainingApiGames / 20);
          setTotalPages(personalizedPages + apiPages);
        }
      } else {
        const data = await fetchGames(currentPage, "", {
          ordering: currentOrdering,
          esrbRatings: allowedEsrbIds,
        });
        const safeGames = (data.results || []).filter(g =>
          isAgeAppropriate(g, allowedEsrbIds)
        );
        setGames(safeGames);
        setTotalPages(Math.max(1, Math.ceil(data.count / 20)));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const getPageTitle = () => {
    if (currentSearch) return `Search Results: "${currentSearch}"`;
    if (hasActiveFilters) return "Filtered Results";
    if (explicitGenres.length > 0 || kgInsights.length > 0)
      return "Recommended For You";
    return "Popular Games";
  };

  return (
    <>
      <Navbar />
      <main className="container">
        <section className="hero">
          <div className="hero-content">
            <div className="eyebrow">Discover • Explore • Play</div>
            <h1>
              Find your next
              <br />
              gaming obsession.
            </h1>
            <p>
              Explore thousands of games with Knowledge Graph-powered
              recommendations based on your unique preferences and interaction
              history.
            </p>
          </div>
        </section>

        {(explicitGenres.length > 0 || kgInsights.length > 0) &&
          !hasActiveFilters && (
            <div className="kg-insight-banner">
              <div className="kg-insight-icon">
                <Brain size={24} />
              </div>
              <div className="kg-insight-content" style={{ flex: 1 }}>
                <h3
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}>
                    <GitBranch size={18} className="text-primary" />
                    Knowledge Graph Insights
                  </span>

                  <span className="age-filter-badge">
                    <Shield size={12} />
                    Filtering for: {getAgeCategoryLabel(allowedEsrbIds)} & Below
                  </span>
                </h3>
                <p
                  className="muted"
                  style={{ fontSize: "0.9rem", margin: "0 0 12px 0" }}>
                  Multi-hop reasoning across{" "}
                  <strong>{kgStats.totalNodes} nodes</strong> and{" "}
                  <strong>{kgStats.totalEdges} edges</strong> detected the
                  following preference patterns from your Solid Pod:
                </p>
                <div className="kg-insight-tags">
                  {kgInsights.map((insight, idx) => (
                    <span
                      key={idx}
                      className="kg-insight-tag"
                      title={insight.detail}>
                      {insight.icon} {insight.label}
                    </span>
                  ))}
                </div>
                <p
                  className="muted"
                  style={{
                    fontSize: "0.8rem",
                    marginTop: "10px",
                    fontStyle: "italic",
                  }}>
                  Hover over recommended games to see the exact graph traversal
                  path.
                </p>
              </div>
            </div>
          )}

        <div className="toolbar-info">
          <div>
            <h2>
              {(explicitGenres.length > 0 || kgInsights.length > 0) &&
                !hasActiveFilters && (
                  <Sparkles
                    size={20}
                    className="text-primary"
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: "8px",
                    }}
                  />
                )}
              {getPageTitle()}
            </h2>
            <div
              className="muted"
              style={{ display: "inline-flex", alignItems: "center" }}>
              {isLoading ? (
                <>
                  <Loader2
                    size={16}
                    className="spinning"
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: "6px",
                    }}
                  />
                  Traversing Knowledge Graph...
                </>
              ) : (
                <span>
                  <strong>{games.length}</strong> games displayed
                </span>
              )}
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="loading">
            <Loader2 size={32} className="spinning" />
            <p>Loading games from the Knowledge Graph...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <AlertCircle size={24} />
            <h3>Failed to fetch data</h3>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <section className="grid">
              {games.length > 0 ? (
                games.map(game => (
                  <GameCard
                    key={game.id}
                    game={game}
                    isPersonalized={personalizedGameIds.has(game.id)}
                    isSaved={savedGameIds.has(String(game.id))}
                    kgReason={game.kgReason || ""}
                  />
                ))
              ) : (
                <div className="empty">
                  <Gamepad2 size={48} />
                  <h3>No age-appropriate games found</h3>
                  <p>Try adjusting your filters or search keywords.</p>
                </div>
              )}
            </section>

            {games.length > 0 && totalPages > 1 && (
              <div className="pagination">
                <button
                  className="ghost-btn"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    setCurrentPage(p => p - 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}>
                  <ChevronLeft size={16} /> Previous
                </button>
                <span className="page-number">
                  Page {currentPage} of {totalPages.toLocaleString()}
                </span>
                <button
                  className="primary-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    setCurrentPage(p => p + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
