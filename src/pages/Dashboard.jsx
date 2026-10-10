import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getDefaultSession } from "@inrupt/solid-client-authn-browser";
import {
  getSolidDataset,
  getThing,
  getStringNoLocale,
} from "@inrupt/solid-client";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  readSettingsFromPod,
  readBehaviorFromPod,
  readRecommendationsFromPod,
  updateSettingsGenres,
  updateSettingsBirthDate,
  removeGameFromPod,
  analyzeUserPreferences,
} from "../services/solidPod";
import { fetchGameDetail, fetchGenres } from "../services/rawgApi";
import {
  Gamepad2,
  Eye,
  Heart,
  Tags,
  BarChart3,
  Building2,
  Code2,
  Monitor,
  Star,
  History,
  Edit,
  Trash2,
  Sparkles,
  RefreshCw,
  X,
  Brain,
  Shield,
  Calendar,
  ShieldCheck,
} from "lucide-react";

const getAgeCategoryLabel = birthDate => {
  if (!birthDate) return "Not Set";
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

  if (age < 10) return "Everyone (E)";
  if (age < 13) return "Everyone 10+";
  if (age < 17) return "Teen (13+)";
  if (age < 18) return "Mature (17+)";
  return "Adults Only (18+)";
};

const renderExplainableText = text => {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const isItalic = line.startsWith("*") && line.endsWith("*");
    const cleanLine = isItalic ? line.slice(1, -1) : line;
    const parts = cleanLine.split(/\*\*(.*?)\*\*/g);
    return (
      <p
        key={lineIdx}
        style={{
          marginBottom: lineIdx === lines.length - 1 ? 0 : "12px",
          fontStyle: isItalic ? "italic" : "normal",
          color: isItalic ? "#94a3b8" : "inherit",
        }}>
        {parts.map((part, partIdx) => {
          if (partIdx % 2 === 1) {
            return (
              <strong
                key={partIdx}
                style={{ color: "#ffffff", fontWeight: 600 }}>
                {part}
              </strong>
            );
          }
          return <span key={partIdx}>{part}</span>;
        })}
      </p>
    );
  });
};

export default function Dashboard() {
  const navigate = useNavigate();
  const session = getDefaultSession();
  const webId = session.info.webId;
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingRecs, setIsGeneratingRecs] = useState(false);
  const [settings, setSettings] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [enrichedGames, setEnrichedGames] = useState({});
  const [userAnalysis, setUserAnalysis] = useState(null);
  const [userName, setUserName] = useState("User");
  const [showAllSavedGames, setShowAllSavedGames] = useState(false);
  const [showAllBehavior, setShowAllBehavior] = useState(false);
  const [isEditingGenres, setIsEditingGenres] = useState(false);
  const [allGenres, setAllGenres] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [isSavingGenres, setIsSavingGenres] = useState(false);
  const [isEditingBirthDate, setIsEditingBirthDate] = useState(false);
  const [tempBirthDate, setTempBirthDate] = useState("");
  const [isSavingBirthDate, setIsSavingBirthDate] = useState(false);

  // =========================================================
  // 1. LOAD POD DATA
  // =========================================================
  useEffect(() => {
    async function loadPodData() {
      try {
        const [settingsData, behaviorData, recsData, analysisData] =
          await Promise.all([
            readSettingsFromPod(webId, session.fetch),
            readBehaviorFromPod(webId, session.fetch),
            readRecommendationsFromPod(webId, session.fetch),
            analyzeUserPreferences(webId, session.fetch),
          ]);

        setSettings(settingsData);
        setInteractions(behaviorData);
        setRecommendations(recsData);
        setUserAnalysis(analysisData);

        if (recsData?.recommendations?.length > 0) {
          const gamesMap = {};
          await Promise.all(
            recsData.recommendations.map(async rec => {
              if (rec.rawgId) {
                try {
                  gamesMap[rec.rawgId] = await fetchGameDetail(rec.rawgId);
                } catch (err) {
                  console.warn(`Failed to fetch game ${rec.rawgId}:`, err);
                }
              }
            })
          );
          setEnrichedGames(gamesMap);
        }
      } catch (error) {
        console.error("Failed to load data from Pod:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadPodData();
  }, [webId, session.fetch]);

  // =========================================================
  // 2. FETCH USERNAME FROM SOLID POD
  // =========================================================
  useEffect(() => {
    async function fetchUserName() {
      if (!webId) return;
      try {
        const profileDataset = await getSolidDataset(webId, {
          fetch: session.fetch,
        });
        const profileThing = getThing(profileDataset, webId);
        const podName =
          getStringNoLocale(profileThing, "http://xmlns.com/foaf/0.1/name") ||
          getStringNoLocale(profileThing, "http://www.w3.org/2006/vcard/ns#fn");

        if (podName) {
          setUserName(podName);
        } else {
          const url = new URL(webId);
          const hostnameParts = url.hostname.split(".");
          let extractedName = "User";
          if (
            hostnameParts.length > 2 &&
            !["www", "pods"].includes(hostnameParts[0])
          ) {
            extractedName = hostnameParts[0];
          } else {
            const pathParts = url.pathname.split("/").filter(p => p.length > 0);
            const namePart = pathParts.find(
              p => p !== "profile" && p !== "card" && !p.includes("#")
            );
            if (namePart) extractedName = namePart;
          }
          setUserName(extractedName);
        }
      } catch (err) {
        console.warn("Failed to read Pod profile:", err);
        setUserName("User");
      }
    }
    fetchUserName();
  }, [webId, session.fetch]);

  // =========================================================
  // 3. HELPER FUNCTIONS & STATS
  // =========================================================
  const stats = {
    totalViews: interactions.filter(i => i.type === "ViewAction").length,
    totalLikes: interactions.filter(i => i.type === "LikeAction").length,
    savedGames: interactions.filter(i => i.type === "LikeAction"),
  };

  const displayedSavedGames = showAllSavedGames
    ? stats.savedGames
    : stats.savedGames.slice(0, 5);
  const displayedBehavior = showAllBehavior
    ? interactions.slice(0, 10)
    : interactions.slice(0, 5);

  // =========================================================
  // 4. HANDLERS
  // =========================================================
  const openGenreEditor = async () => {
    setIsEditingGenres(true);
    setSelectedGenres(settings?.genres || []);
    try {
      const data = await fetchGenres();
      setAllGenres(data.results || []);
    } catch (err) {
      console.error("Failed to fetch genres:", err);
    }
  };

  const toggleGenreInEditor = genreName => {
    if (selectedGenres.includes(genreName)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genreName));
    } else if (selectedGenres.length < 5) {
      setSelectedGenres([...selectedGenres, genreName]);
    } else {
      alert("Maximum 5 genres allowed!");
    }
  };

  const handleSaveGenres = async () => {
    if (selectedGenres.length < 3)
      return alert("Please select at least 3 genres!");
    setIsSavingGenres(true);
    try {
      await updateSettingsGenres(session, selectedGenres);
      setSettings({ ...settings, genres: selectedGenres });
      sessionStorage.removeItem("gamepod_user_genres");
      sessionStorage.removeItem("gamepod_combined_games");
      sessionStorage.removeItem("gamepod_personalized_ids");
      setIsEditingGenres(false);
      alert("Genre preferences updated successfully!");
    } catch (err) {
      alert("Failed to update genres: " + err.message);
    } finally {
      setIsSavingGenres(false);
    }
  };

  const openBirthDateEditor = () => {
    setTempBirthDate(settings?.birthDate || "");
    setIsEditingBirthDate(true);
  };

  const handleSaveBirthDate = async () => {
    if (!tempBirthDate) return alert("Please select a valid date!");
    setIsSavingBirthDate(true);
    try {
      await updateSettingsBirthDate(session, tempBirthDate);
      setSettings({ ...settings, birthDate: tempBirthDate });
      setIsEditingBirthDate(false);
      alert(
        "Age restriction updated successfully! Recommendations will now be filtered."
      );
    } catch (err) {
      alert("Failed to update birth date: " + err.message);
    } finally {
      setIsSavingBirthDate(false);
    }
  };

  const handleRemoveGame = async (gameId, gameName) => {
    if (!confirm(`Remove "${gameName}" from your Pod?`)) return;
    try {
      await removeGameFromPod(session, gameId);
      setInteractions(interactions.filter(i => i.gameId !== gameId));
      alert(`"${gameName}" removed successfully.`);
    } catch (err) {
      alert("Failed to remove: " + err.message);
    }
  };

  const handleGenerateRecs = async () => {
    setIsGeneratingRecs(true);
    try {
      const { generateAutoRecommendations } = await import(
        "../services/solidPod"
      );
      const result = await generateAutoRecommendations(session);
      setRecommendations({
        description: result.autoQuery,
        recommendations: result.recommendations,
      });

      const gamesMap = {};
      await Promise.all(
        result.recommendations.map(async rec => {
          if (rec.rawData) gamesMap[rec.rawgId] = rec.rawData;
        })
      );
      setEnrichedGames(gamesMap);
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setIsGeneratingRecs(false);
    }
  };

  // =========================================================
  // LOADING STATE
  // =========================================================
  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="container dashboard-loading-container">
          <div className="loading">
            Analyzing your Solid Pod Knowledge Graph...
          </div>
        </div>
      </>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================
  return (
    <>
      <Navbar />
      <main className="container dashboard-page">
        {/* 1. HEADER */}
        <section className="panel dashboard-header">
          <h2 className="dashboard-title">
            <Gamepad2 size={28} className="text-primary" />
            GamePod Dashboard — {userName}
          </h2>
          <p className="muted dashboard-subtitle">
            Your preference and behavior data is securely stored in your{" "}
            <strong>Solid Pod</strong>.
          </p>
        </section>

        {/* 2. STATISTICS */}
        <div className="stats-grid-responsive">
          <div className="panel dashboard-stat-card">
            <div className="dashboard-stat-value">
              <Eye size={24} /> {stats.totalViews}
            </div>
            <div className="muted dashboard-stat-label">Games Viewed</div>
          </div>
          <div className="panel dashboard-stat-card">
            <div className="dashboard-stat-value">
              <Heart size={24} /> {stats.totalLikes}
            </div>
            <div className="muted dashboard-stat-label">Games Saved</div>
          </div>
          <div className="panel dashboard-stat-card">
            <div className="dashboard-stat-value">
              <Tags size={24} /> {settings?.genres?.length || 0}
            </div>
            <div className="muted dashboard-stat-label">Favorite Genres</div>
          </div>
        </div>

        {/* 3. KNOWLEDGE GRAPH ANALYSIS */}
        {userAnalysis && userAnalysis.totalInteractions > 0 && (
          <section className="panel kg-analysis-section">
            <h3 className="kg-analysis-title">
              <BarChart3 size={20} className="text-primary" />
              Knowledge Graph Analysis
            </h3>
            <div className="kg-chart-grid">
              {/* GENRE */}
              {userAnalysis.genreAnalysis.length > 0 && (
                <div className="kg-analysis-card">
                  <h4 className="kg-analysis-card-title">
                    <Tags size={14} /> Genres
                  </h4>
                  {userAnalysis.genreAnalysis.slice(0, 3).map((genre, idx) => {
                    const percentage =
                      (genre.total / userAnalysis.genreAnalysis[0].total) * 100;
                    return (
                      <div key={idx} className="kg-analysis-item">
                        <div className="kg-analysis-item-header">
                          <span className="kg-analysis-item-name">
                            {genre.name}
                          </span>
                          <span className="muted">{genre.total}</span>
                        </div>
                        <div className="kg-analysis-bar">
                          <div
                            className={`kg-analysis-bar-fill ${
                              idx === 0
                                ? "kg-bar-primary"
                                : idx === 1
                                ? "kg-bar-secondary"
                                : "kg-bar-light"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* PUBLISHER */}
              {userAnalysis.publisherAnalysis.length > 0 && (
                <div className="kg-analysis-card">
                  <h4 className="kg-analysis-card-title">
                    <Building2 size={14} /> Publishers
                  </h4>
                  {userAnalysis.publisherAnalysis
                    .slice(0, 3)
                    .map((pub, idx) => {
                      const percentage =
                        (pub.count / userAnalysis.publisherAnalysis[0].count) *
                        100;
                      return (
                        <div key={idx} className="kg-analysis-item">
                          <div className="kg-analysis-item-header">
                            <span className="kg-analysis-item-name">
                              {pub.name}
                            </span>
                            <span className="muted">{pub.count}</span>
                          </div>
                          <div className="kg-analysis-bar">
                            <div
                              className="kg-analysis-bar-fill kg-bar-publisher"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              {/* DEVELOPER */}
              {userAnalysis.developerAnalysis.length > 0 && (
                <div className="kg-analysis-card">
                  <h4 className="kg-analysis-card-title">
                    <Code2 size={14} /> Developers
                  </h4>
                  {userAnalysis.developerAnalysis
                    .slice(0, 3)
                    .map((dev, idx) => {
                      const percentage =
                        (dev.count / userAnalysis.developerAnalysis[0].count) *
                        100;
                      return (
                        <div key={idx} className="kg-analysis-item">
                          <div className="kg-analysis-item-header">
                            <span className="kg-analysis-item-name">
                              {dev.name}
                            </span>
                            <span className="muted">{dev.count}</span>
                          </div>
                          <div className="kg-analysis-bar">
                            <div
                              className="kg-analysis-bar-fill kg-bar-developer"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              {/* PLATFORM */}
              {userAnalysis.platformAnalysis.length > 0 && (
                <div className="kg-analysis-card">
                  <h4 className="kg-analysis-card-title">
                    <Monitor size={14} /> Platforms
                  </h4>
                  {userAnalysis.platformAnalysis
                    .slice(0, 3)
                    .map((plat, idx) => {
                      const percentage =
                        (plat.count / userAnalysis.platformAnalysis[0].count) *
                        100;
                      return (
                        <div key={idx} className="kg-analysis-item">
                          <div className="kg-analysis-item-header">
                            <span className="kg-analysis-item-name no-truncate">
                              {plat.name}
                            </span>
                            <span className="muted">{plat.count}</span>
                          </div>
                          <div className="kg-analysis-bar">
                            <div
                              className="kg-analysis-bar-fill kg-bar-platform"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              {/* RATINGS */}
              <div className="kg-analysis-card">
                <h4 className="kg-analysis-card-title">
                  <Star size={14} /> Ratings
                </h4>
                {userAnalysis.ratingAnalysis.map((rating, idx) => {
                  const maxCount = Math.max(
                    ...userAnalysis.ratingAnalysis.map(r => r.count)
                  );
                  const percentage =
                    maxCount > 0 ? (rating.count / maxCount) * 100 : 0;
                  return (
                    <div key={idx} className="kg-analysis-item">
                      <div className="kg-analysis-item-header">
                        <span className="kg-analysis-item-name no-truncate">
                          {rating.range}
                        </span>
                        <span className="muted">{rating.count}</span>
                      </div>
                      <div className="kg-analysis-bar">
                        <div
                          className={`kg-analysis-bar-fill ${
                            [
                              "kg-bar-rating-1",
                              "kg-bar-rating-2",
                              "kg-bar-rating-3",
                              "kg-bar-rating-4",
                            ][idx]
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="preference-pattern">
              <div className="preference-pattern-icon">
                <Brain size={24} />
              </div>
              <div className="preference-pattern-content">
                <div className="preference-pattern-title">
                  <Sparkles size={16} /> Your Preference Pattern Analysis
                </div>
                <div className="preference-pattern-text">
                  {renderExplainableText(userAnalysis.explainableText)}
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="dashboard-split-grid">
          <section className="panel">
            <div className="dashboard-section-header">
              <h3 className="dashboard-section-title">
                <Heart size={18} className="text-primary" /> Saved Games
              </h3>
              <span className="muted dashboard-source">
                Source: behavior.ttl
              </span>
            </div>
            {stats.savedGames.length > 0 ? (
              <>
                <div className="custom-scroll saved-games-list">
                  {displayedSavedGames.map((game, i) => (
                    <div key={i} className="saved-game-item">
                      <Link
                        to={`/game/${game.gameId}`}
                        className="saved-game-link"
                        title={game.gameName}>
                        {game.gameName || "Unknown Game"}
                      </Link>
                      <button
                        onClick={() =>
                          handleRemoveGame(game.gameId, game.gameName)
                        }
                        title="Remove from Pod"
                        className="saved-game-remove">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                {stats.savedGames.length > 5 && (
                  <button
                    onClick={() => setShowAllSavedGames(!showAllSavedGames)}
                    className="ghost-btn dashboard-full-button">
                    {showAllSavedGames ? (
                      <>
                        <span>▲</span> Show Less
                      </>
                    ) : (
                      <>
                        <span>▼</span> View All ({stats.savedGames.length}{" "}
                        games)
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <p className="muted dashboard-empty">No games saved yet.</p>
            )}
          </section>

          <section className="panel">
            <div className="dashboard-section-header">
              <h3 className="dashboard-section-title">
                <Tags size={18} className="text-primary" /> Preferences
              </h3>
            </div>
            <p className="muted dashboard-description">Source: settings.ttl</p>

            {/* Display Birth Date / Age Restriction */}
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}>
                <span
                  style={{
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}>
                  <Shield size={14} className="text-primary" /> Age Restriction
                </span>
                <button
                  className="ghost-btn"
                  style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                  onClick={openBirthDateEditor}>
                  <Edit size={12} /> Edit
                </button>
              </div>
              <div
                className="tag dashboard-genre-tag"
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  color: "#10b981",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}>
                <Calendar size={12} />
                {settings?.birthDate
                  ? `${new Date(
                      settings.birthDate
                    ).toLocaleDateString()} (${getAgeCategoryLabel(
                      settings.birthDate
                    )})`
                  : "Not Set"}
              </div>
            </div>

            {/* Existing Genres Display */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}>
                <span style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                  Favorite Genres
                </span>
                <button
                  className="ghost-btn"
                  style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                  onClick={openGenreEditor}>
                  <Edit size={12} /> Edit
                </button>
              </div>
              {settings?.genres?.length > 0 ? (
                <div className="dashboard-genre-list">
                  {settings.genres.map((genre, i) => (
                    <span key={i} className="tag dashboard-genre-tag">
                      {genre}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">No preferences set yet.</p>
              )}
            </div>
          </section>
        </div>

        {/* 5. AI PERSONAL RECOMMENDATIONS */}
        <section className="panel ai-recommendation-section">
          <div className="ai-recommendation-header">
            <h3 className="ai-recommendation-title">
              <Sparkles size={20} className="text-primary" /> AI Personal
              Recommendations
            </h3>
            {recommendations?.recommendations?.length > 0 && (
              <span className="rec-counter-badge">
                <Gamepad2 size={14} /> {recommendations.recommendations.length}{" "}
                Games Found
              </span>
            )}
            <button
              onClick={handleGenerateRecs}
              disabled={isGeneratingRecs}
              className="ghost-btn ai-regenerate-button">
              <RefreshCw
                size={14}
                className={isGeneratingRecs ? "spinning" : ""}
              />
              {isGeneratingRecs ? "Generating..." : "Regenerate"}
            </button>
          </div>

          {isGeneratingRecs ? (
            <div className="skeleton-list">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton-rec-card">
                  <div className="skeleton skeleton-image" />
                  <div className="skeleton-content">
                    <div className="skeleton skeleton-line w-75" />
                    <div className="skeleton skeleton-line w-50" />
                    <div className="skeleton skeleton-line h-60 w-100" />
                    <div className="skeleton skeleton-line w-50" />
                  </div>
                </div>
              ))}
              <p className="ai-loading-text">
                AI is analyzing your Knowledge Graph...
              </p>
            </div>
          ) : recommendations?.recommendations?.length > 0 ? (
            <div className="recommendation-list">
              {recommendations.recommendations.map((rec, idx) => {
                const gameData = enrichedGames[rec.rawgId];
                const esrbRating = gameData?.esrb_rating?.name || "NR";
                const esrbId = gameData?.esrb_rating?.id;

                return (
                  <div
                    key={idx}
                    className="rec-card rec-card-animate"
                    style={{ animationDelay: `${idx * 0.1}s` }}>
                    {gameData ? (
                      <Link to={`/game/${gameData.id}`}>
                        <img
                          src={
                            gameData.background_image ||
                            "https://via.placeholder.com/140x190/111528/ffffff?text=No+Image"
                          }
                          alt={rec.name}
                          className="rec-card-image"
                        />
                      </Link>
                    ) : (
                      <div className="skeleton skeleton-image" />
                    )}
                    <div className="rec-card-content">
                      <div className="rec-card-header">
                        <h4 className="rec-card-title">
                          {gameData ? (
                            <Link
                              to={`/game/${gameData.id}`}
                              className="rec-card-title-link">
                              {rec.name}
                            </Link>
                          ) : (
                            rec.name
                          )}
                        </h4>
                        {gameData?.rating && (
                          <span className="rec-card-rating">
                            <Star size={14} fill="#facc15" /> {gameData.rating}
                          </span>
                        )}
                      </div>
                      {gameData && (
                        <div className="muted rec-card-meta">
                          <Tags size={14} />{" "}
                          {(gameData.genres || [])
                            .slice(0, 3)
                            .map(g => g.name)
                            .join(" • ")}
                          {" • "}{" "}
                          {gameData.released
                            ? new Date(gameData.released).getFullYear()
                            : "TBA"}
                          <span
                            className="rec-esrb-badge"
                            title={`ESRB Rating: ${esrbRating}`}>
                            <ShieldCheck size={12} />
                            {esrbRating}
                          </span>
                        </div>
                      )}
                      {rec.reviewBody && (
                        <div className="rec-card-reason">
                          <div className="rec-card-reason-title">
                            <Brain size={12} /> Why this matches you
                          </div>
                          <div className="rec-card-reason-text">
                            "{rec.reviewBody}"
                          </div>
                        </div>
                      )}
                      <div className="rec-card-actions">
                        {gameData && (
                          <>
                            <Link
                              to={`/game/${gameData.id}`}
                              className="primary-btn rec-card-details-button">
                              View Details
                            </Link>
                            <span className="muted rec-card-position">
                              #{idx + 1} of{" "}
                              {recommendations.recommendations.length}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ai-empty">
              <Sparkles size={48} className="muted ai-empty-icon" />
              <h3 className="ai-empty-title">No AI Recommendations Yet</h3>
              <p className="muted ai-empty-description">
                Use the features below to get personalized recommendations.
              </p>
              <div className="ai-empty-actions">
                <button
                  className="primary-btn ai-empty-button"
                  onClick={handleGenerateRecs}
                  disabled={isGeneratingRecs}>
                  <Sparkles size={18} />{" "}
                  {isGeneratingRecs
                    ? "Generating..."
                    : "Generate Automatically"}
                </button>
                <Link to="/vibe-search" className="ghost-btn ai-empty-button">
                  <History size={18} /> Manual Vibe Search
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* 6. INTERACTION HISTORY */}
        {interactions.length > 0 && (
          <section className="panel interaction-history-section">
            <div className="dashboard-section-header">
              <h3 className="dashboard-section-title">
                <History size={18} className="text-primary" /> Interaction
                History
              </h3>
              <span className="muted dashboard-source">
                Source: behavior.ttl
              </span>
            </div>
            <div className="custom-scroll interaction-history-list">
              {displayedBehavior.map((interaction, i) => (
                <div key={i} className="interaction-item">
                  <div className="interaction-item-left">
                    <span
                      className={`interaction-icon ${
                        interaction.type === "LikeAction" ? "is-like" : ""
                      }`}>
                      {interaction.type === "LikeAction" ? (
                        <Heart size={18} fill="#646cff" />
                      ) : (
                        <Eye size={18} />
                      )}
                    </span>
                    <strong className="interaction-game-name">
                      {interaction.gameName || "Unknown Game"}
                    </strong>
                  </div>
                  <span className="muted interaction-time">
                    {new Date(interaction.timestamp).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
            {interactions.length > 5 && (
              <button
                onClick={() => setShowAllBehavior(!showAllBehavior)}
                className="ghost-btn dashboard-full-button">
                {showAllBehavior ? (
                  <>
                    <span>▲</span> Show Last 5
                  </>
                ) : (
                  <>
                    <span>▼</span> View Last 10 (Total: {interactions.length})
                  </>
                )}
              </button>
            )}
          </section>
        )}
        <Footer />
      </main>

      {/* 7. MODAL EDIT GENRE */}
      {isEditingGenres && (
        <div className="genre-modal-overlay">
          <div className="panel genre-modal">
            <button
              onClick={() => setIsEditingGenres(false)}
              className="genre-modal-close">
              <X size={20} />
            </button>
            <h2 className="genre-modal-title">
              <Tags size={24} className="text-primary" /> Edit Genre Preferences
            </h2>
            <p className="muted genre-modal-description">
              Select between 3 and 5 genres. Changes will be saved to your{" "}
              <code>settings.ttl</code>.
            </p>
            <div className="genre-list">
              {allGenres.map(genre => (
                <button
                  key={genre.id}
                  onClick={() => toggleGenreInEditor(genre.name)}
                  className={`genre-option ${
                    selectedGenres.includes(genre.name) ? "selected" : ""
                  }`}>
                  {genre.name} {selectedGenres.includes(genre.name) && " ✓"}
                </button>
              ))}
            </div>
            <div className="genre-modal-footer">
              <span className="muted">
                {selectedGenres.length} / 5 genres selected
              </span>
              <div className="genre-modal-actions">
                <button
                  className="ghost-btn genre-cancel-button"
                  onClick={() => setIsEditingGenres(false)}>
                  Cancel
                </button>
                <button
                  className="primary-btn genre-save-button"
                  onClick={handleSaveGenres}
                  disabled={isSavingGenres || selectedGenres.length < 3}>
                  {isSavingGenres ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL EDIT BIRTH DATE */}
      {isEditingBirthDate && (
        <div className="genre-modal-overlay">
          <div className="panel genre-modal" style={{ maxWidth: "400px" }}>
            <button
              onClick={() => setIsEditingBirthDate(false)}
              className="genre-modal-close">
              <X size={20} />
            </button>
            <h2 className="genre-modal-title">
              <Shield size={24} className="text-primary" /> Edit Age Restriction
            </h2>
            <p className="muted genre-modal-description">
              Update your date of birth to ensure recommendations remain
              age-appropriate. This updates your <code>settings.ttl</code>.
            </p>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                }}>
                Date of Birth
              </label>
              <input
                type="date"
                value={tempBirthDate}
                onChange={e => setTempBirthDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="form-input-dob"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border, #334155)",
                  backgroundColor: "var(--bg-input, #1e293b)",
                  color: "var(--text, #f8fafc)",
                }}
              />
            </div>
            <div
              className="genre-modal-footer"
              style={{ justifyContent: "flex-end", gap: "10px" }}>
              <button
                className="ghost-btn genre-cancel-button"
                onClick={() => setIsEditingBirthDate(false)}>
                Cancel
              </button>
              <button
                className="primary-btn genre-save-button"
                onClick={handleSaveBirthDate}
                disabled={isSavingBirthDate || !tempBirthDate}>
                {isSavingBirthDate ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
