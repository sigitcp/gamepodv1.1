import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getDefaultSession } from "@inrupt/solid-client-authn-browser";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SeedSelector from "../components/SeedSelector";
import { readSettingsFromPod, readBehaviorFromPod } from "../services/solidPod";
import {
  saveSessionToPod,
  saveSeedsToPod,
  saveRecommendationsToPod,
} from "../services/solidPod";
import { fetchCandidateGames } from "../services/rawgApi";
import { generateRecommendations } from "../services/openRouter";
import {
  Sparkles,
  Search,
  Star,
  AlertCircle,
  Loader2,
  Gamepad2,
  Lightbulb,
  Database,
  Tags,
  ShieldCheck,
  Shield,
} from "lucide-react";

// =========================================================
// HELPER FUNCTIONS (Age Restriction)
// =========================================================
const getAllowedEsrbIds = birthDate => {
  if (!birthDate) return [1, 2, 3, 4, 5];
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

  if (age < 10) return [1, 2];
  if (age < 13) return [1, 2];
  if (age < 17) return [1, 2, 3];
  if (age < 18) return [1, 2, 3, 4];
  return [1, 2, 3, 4, 5];
};

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

const isAgeAppropriate = (game, allowedIds) => {
  if (
    !game.esrb_rating ||
    game.esrb_rating.id === null ||
    game.esrb_rating.id === undefined
  ) {
    const isAdult = allowedIds.includes(4) || allowedIds.includes(5);
    return isAdult;
  }
  return allowedIds.includes(Number(game.esrb_rating.id));
};

export default function VibeSearch() {
  const navigate = useNavigate();
  const session = getDefaultSession();
  const webId = session.info.webId;

  const [vibeQuery, setVibeQuery] = useState("");
  const [selectedSeeds, setSelectedSeeds] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [error, setError] = useState("");
  const [activeAgeFilter, setActiveAgeFilter] = useState("Not Set");

  const handleGenerate = async () => {
    if (!vibeQuery.trim() && selectedSeeds.length === 0) {
      alert("Please enter a vibe query OR select at least 1 seed game.");
      return;
    }

    if (!session.info.isLoggedIn) {
      alert("Please log in first.");
      navigate("/login");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      // 1. Read User Context from Pod
      const [settings, behavior] = await Promise.all([
        readSettingsFromPod(webId, session.fetch),
        readBehaviorFromPod(webId, session.fetch),
      ]);

      const preferredGenres = settings?.genres || [];
      const birthDate = settings?.birthDate || null;
      const allowedEsrbIds = getAllowedEsrbIds(birthDate);
      setActiveAgeFilter(getAgeCategoryLabel(birthDate));

      let fetchGenres = preferredGenres;
      let searchQuery = vibeQuery;

      if (selectedSeeds.length > 0) {
        // Extract genres from seed games to guide the API, ignoring the raw text query for the API call
        const seedGenres = [
          ...new Set(
            selectedSeeds.flatMap(s => s.genres?.map(g => g.name) || [])
          ),
        ];
        if (seedGenres.length > 0) {
          fetchGenres = seedGenres.slice(0, 3); // Max 3 genres for RAWG API
          searchQuery = ""; // Clear keyword search to force genre-based retrieval
        }
      }

      // Fetch broader candidate pool (60 games) with strict ESRB filtering at the API level
      const rawCandidates = await fetchCandidateGames(
        fetchGenres,
        searchQuery,
        60,
        allowedEsrbIds
      );

      // DEFENSE IN DEPTH: Client-side age filtering before sending to LLM
      const candidates = rawCandidates.filter(game =>
        isAgeAppropriate(game, allowedEsrbIds)
      );

      if (candidates.length === 0) {
        throw new Error(
          "No age-appropriate candidate games found. Please try a different query or adjust seeds."
        );
      }

      // 2. Build Context for LLM
      const context = {
        preferredGenres,
        seedGames: selectedSeeds,
        recentBehavior: behavior,
        vibeQuery,
        ageRestriction: `Strictly filter out any game above the rating: ${getAgeCategoryLabel(
          birthDate
        )}.`, // Tell LLM about the rule
      };

      // 3. LLM Generation
      const llmResult = await generateRecommendations(context, candidates);

      if (
        !llmResult.recommendations ||
        llmResult.recommendations.length === 0
      ) {
        throw new Error(
          "AI could not generate recommendations. Please try a different query."
        );
      }

      // 4. Enrich Data
      const enrichedRecs = await Promise.all(
        llmResult.recommendations.map(async rec => {
          try {
            const candidate = candidates.find(c => c.id === rec.rawgId);
            return { ...rec, rawData: candidate || null };
          } catch (err) {
            return { ...rec, rawData: null };
          }
        })
      );

      const finalResult = {
        recommendations: enrichedRecs,
        reasoning: llmResult.reasoning,
        model: llmResult.model,
      };

      setRecommendations(finalResult);

      // 5. Persist to Pod
      const sessionId = `vibe-session-${Date.now()}`;
      await Promise.all([
        saveSessionToPod(
          session,
          sessionId,
          vibeQuery,
          preferredGenres,
          selectedSeeds.map(s => s.id)
        ),
        selectedSeeds.length > 0
          ? saveSeedsToPod(session, sessionId, selectedSeeds)
          : Promise.resolve(),
        saveRecommendationsToPod(session, sessionId, vibeQuery, enrichedRecs),
      ]);
    } catch (err) {
      console.error("Failed to generate recommendations:", err);
      setError(
        err.message || "An error occurred while generating recommendations."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="container vibe-main-container">
        {/* 1. Header */}
        <section className="panel vibe-header">
          <h2 className="vibe-header-title">
            <Sparkles size={28} className="text-primary" /> Semantic Vibe Search
          </h2>
          <p className="muted vibe-header-desc">
            Describe the mood, mechanics, or atmosphere of the game you want.
            The system uses LLM semantic understanding, anchored by your
            preferences and seeds.
          </p>
        </section>

        {/* 2. Form Input */}
        <section className="panel vibe-form-section">
          <div className="mb-4">
            <label className="form-label">
              <Search size={18} className="text-primary" /> Vibe Query
            </label>
            <textarea
              className="custom-textarea"
              value={vibeQuery}
              onChange={e => setVibeQuery(e.target.value)}
              placeholder='e.g., "challenging open-world action RPG with deep lore, dark fantasy atmosphere, and stealth mechanics"'
              rows={3}
            />
            <div className="form-hint">
              <Lightbulb size={16} />
              <span>
                Tip: Focus on atmosphere, mechanics, and feelings rather than
                just game titles.
              </span>
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label">
              <Gamepad2 size={18} className="text-primary" /> Seed Games
              (Optional but Recommended)
            </label>
            <SeedSelector
              selectedSeeds={selectedSeeds}
              onSeedsChange={setSelectedSeeds}
              maxSeeds={3}
            />
            <div className="form-hint" style={{ marginTop: "8px" }}>
              <Shield
                size={14}
                style={{
                  display: "inline",
                  verticalAlign: "middle",
                  marginRight: "4px",
                }}
              />
              <span>
                Active Age Filter: <strong>{activeAgeFilter} & Below</strong>
              </span>
            </div>
          </div>

          <div className="text-center">
            <button
              className="primary-btn vibe-generate-btn"
              onClick={handleGenerate}
              disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="spinning" /> Processing...
                </>
              ) : (
                <>
                  <Sparkles size={20} /> Generate Recommendations
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="error-box">
              <AlertCircle size={20} /> {error}
            </div>
          )}
        </section>

        {/* 3. Results Section */}
        {(isGenerating || recommendations) && (
          <section className="panel ai-recommendations-section vibe-results-section">
            {/* Loading State */}
            {isGenerating ? (
              <>
                <div className="vibe-results-header">
                  <h3 className="section-title">
                    <Sparkles size={20} className="text-primary" /> Generating
                    Recommendations...
                  </h3>
                </div>
                <div className="vibe-results-list">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton-rec-card">
                      <div className="skeleton skeleton-image"></div>
                      <div className="skeleton-content">
                        <div className="skeleton skeleton-line w-75"></div>
                        <div className="skeleton skeleton-line w-50"></div>
                        <div className="skeleton skeleton-line h-60 w-100"></div>
                        <div className="skeleton skeleton-line w-50"></div>
                      </div>
                    </div>
                  ))}
                  <p className="loading-text-center">
                    AI is analyzing semantics and your Knowledge Graph...
                  </p>
                </div>
              </>
            ) : (
              /* Success State */
              <>
                <div className="vibe-results-header">
                  <h3 className="section-title">
                    <Sparkles size={20} className="text-primary" />{" "}
                    Recommendations For You
                  </h3>
                  <span className="rec-counter-badge">
                    <Gamepad2 size={14} />{" "}
                    {recommendations.recommendations.length} Games Found
                  </span>
                </div>

                <div className="vibe-results-list">
                  {recommendations.recommendations.map((rec, idx) => {
                    const gameData = rec.rawData;
                    const esrbRating = gameData?.esrb_rating?.name || "NR";

                    return (
                      <div key={idx} className="rec-card rec-card-animate">
                        {gameData ? (
                          <Link to={`/game/${gameData.id}`}>
                            <img
                              src={
                                gameData.background_image ||
                                "https://via.placeholder.com/140x190/111528/ffffff?text=No+Image"
                              }
                              alt={rec.name}
                              className="rec-card-image"
                              onError={e => {
                                e.target.src =
                                  "https://via.placeholder.com/140x190/111528/ffffff?text=No+Image";
                              }}
                            />
                          </Link>
                        ) : (
                          <div className="skeleton skeleton-image"></div>
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
                                <Star size={14} fill="#facc15" />{" "}
                                {gameData.rating}
                              </span>
                            )}
                          </div>

                          {gameData && (
                            <div className="rec-card-meta">
                              <Tags size={14} />{" "}
                              {(gameData.genres || [])
                                .slice(0, 3)
                                .map(g => g.name)
                                .join(" • ")}
                              {" • "}
                              {gameData.released
                                ? new Date(gameData.released).getFullYear()
                                : "TBA"}
                              {/* NEW: ESRB Badge */}
                              <span
                                className="rec-esrb-badge"
                                title={`ESRB Rating: ${esrbRating}`}>
                                <ShieldCheck size={12} />
                                {esrbRating}
                              </span>
                            </div>
                          )}

                          {rec.reviewBody && (
                            <div className="rec-card-review">
                              <div className="rec-card-review-label">
                                <Sparkles
                                  size={12}
                                  style={{ marginRight: "4px" }}
                                />{" "}
                                Why this matches your vibe
                              </div>
                              <div className="rec-card-review-text">
                                "{rec.reviewBody}"
                              </div>
                            </div>
                          )}

                          <div className="rec-card-actions">
                            {gameData && (
                              <>
                                <Link
                                  to={`/game/${gameData.id}`}
                                  className="primary-btn rec-card-detail-btn">
                                  View Details
                                </Link>
                                <span className="muted rec-card-index">
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
              </>
            )}
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
