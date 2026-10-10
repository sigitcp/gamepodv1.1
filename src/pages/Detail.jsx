import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getDefaultSession } from "@inrupt/solid-client-authn-browser";
import {
  fetchGameDetail,
  fetchScreenshots,
  fetchMovies,
} from "../services/rawgApi";
import { saveBehaviorToPod, readBehaviorFromPod } from "../services/solidPod";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  Bookmark,
  Check,
  Star,
  Calendar,
  Clock,
  Image as ImageIcon,
  Film,
  Info,
  ShieldCheck,
} from "lucide-react";

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = getDefaultSession();

  const [game, setGame] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [movies, setMovies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const [gameData, screensData, moviesData] = await Promise.all([
          fetchGameDetail(id),
          fetchScreenshots(id),
          fetchMovies(id),
        ]);

        if (!isMounted) return;

        setGame(gameData);
        setScreenshots(screensData.slice(0, 6));
        setMovies(moviesData.slice(0, 3));

        // 1. Record View Action
        if (session.info.isLoggedIn && session.info.webId && !hasViewed) {
          try {
            await saveBehaviorToPod(session, id, gameData.name, "ViewAction");
            setHasViewed(true);
          } catch (err) {
            console.warn("Failed to record ViewAction:", err.message);
          }
        }

        // 2. Check if game is already saved (LikeAction)
        if (session.info.isLoggedIn && session.info.webId) {
          try {
            const behavior = await readBehaviorFromPod(
              session.info.webId,
              session.fetch
            );
            const hasLiked = behavior.some(
              b => b.type === "LikeAction" && String(b.gameId) === String(id)
            );
            setIsSaved(hasLiked);
          } catch (err) {
            console.warn("Failed to check saved status:", err);
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [id, session.info.isLoggedIn, session.info.webId, hasViewed]);

  const handleSaveToPod = async () => {
    if (!session.info.isLoggedIn) {
      alert("Please log in to your Solid Pod first to save this game.");
      navigate("/login");
      return;
    }

    setIsSaving(true);
    try {
      await saveBehaviorToPod(session, id, game.name, "LikeAction");
      setIsSaved(true); 
      alert(`"${game.name}" has been successfully saved to your Pod!`);
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Failed to save to Pod. Please ensure you granted Write Access.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div
          className="container"
          style={{ marginTop: "50px", textAlign: "center" }}>
          <div className="loading">Loading game details...</div>
        </div>
      </>
    );
  }

  if (error || !game) {
    return (
      <>
        <Navbar />
        <div className="container" style={{ marginTop: "50px" }}>
          <div className="error">
            <h2>Game not found or failed to load</h2>
            <p>{error || "Game ID is not available."}</p>
            <Link className="primary-btn" to="/">
              ← Back to Catalog
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="container">
        <section
          className="detail-hero"
          style={{ backgroundImage: `url('${game.background_image || ""}')` }}>
          <div className="detail-hero-content">
            <Link className="back-link" to="/">
              ← Back to catalog
            </Link>
            <h1 className="detail-title">{game.name}</h1>
            <div className="detail-meta">
              <span className="detail-rating">
                <Star
                  size={16}
                  fill="currentColor"
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: "4px",
                  }}
                />
                {game.rating ?? "-"}
              </span>
              <span>Metacritic: {game.metacritic ?? "-"}</span>
              <span>
                <Calendar
                  size={14}
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: "4px",
                  }}
                />
                Released: {game.released || "-"}
              </span>
              <span>
                <Clock
                  size={14}
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: "4px",
                  }}
                />
                Playtime: {game.playtime ? `${game.playtime} hrs` : "-"}
              </span>

              <span>
                <ShieldCheck
                  size={14}
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: "4px",
                  }}
                />
                {game.esrb_rating?.name || "NR"}
              </span>
            </div>
            <div className="tags">
              {(game.genres || []).map((g, i) => (
                <span key={i} className="tag">
                  {g.name}
                </span>
              ))}
            </div>

            {/* SAVE / SAVED BUTTONS */}
            {!isSaved ? (
              <button
                className="detail-save-btn"
                onClick={handleSaveToPod}
                disabled={isSaving}>
                <Bookmark size={18} />
                {isSaving ? "Saving..." : "Save to My Pod"}
              </button>
            ) : (
              <div className="detail-saved-btn">
                <Check size={18} />
                Saved to Pod
              </div>
            )}
          </div>
        </section>

        {/* Detail Layout */}
        <section className="detail-layout">
          <div>
            <article className="panel">
              <h3>
                <Info
                  size={18}
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: "8px",
                  }}
                />
                About This Game
              </h3>
              <div className="description">
                {game.description_raw || "No description available."}
              </div>
            </article>

            {screenshots.length > 0 && (
              <article className="panel" style={{ marginTop: "20px" }}>
                <h3>
                  <ImageIcon
                    size={18}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: "8px",
                    }}
                  />
                  Screenshots
                </h3>
                <div className="screenshots">
                  {screenshots.map((s, i) => (
                    <img
                      key={i}
                      className="screenshot"
                      src={s.image}
                      alt={`Screenshot ${i + 1}`}
                      loading="lazy"
                    />
                  ))}
                </div>
              </article>
            )}

            {movies.length > 0 && (
              <article className="panel" style={{ marginTop: "20px" }}>
                <h3>
                  <Film
                    size={18}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: "8px",
                    }}
                  />
                  Trailers & Gameplay
                </h3>
                <div className="trailer-list">
                  {movies.map((movie, i) => {
                    const videoUrl =
                      movie.data?.max || movie.data?.["480"] || "";
                    if (!videoUrl) return null;
                    return (
                      <div key={i} className="trailer-item">
                        <video
                          className="trailer-video"
                          controls
                          preload="metadata"
                          poster={movie.preview || ""}>
                          <source src={videoUrl} type="video/mp4" />
                        </video>
                        <div className="trailer-info">
                          <strong>{movie.name || "Gameplay"}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            )}
          </div>

          {/* Sidebar Info */}
          <aside className="panel">
            <h3>Game Information</h3>
            <div className="info-list">
              <div className="info-row">
                <span className="info-label">Developer</span>
                <span className="info-value">
                  {(game.developers || []).map(d => d.name).join(", ") || "-"}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Publisher</span>
                <span className="info-value">
                  {(game.publishers || []).map(p => p.name).join(", ") || "-"}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Platform</span>
                <span className="info-value">
                  {(game.platforms || [])
                    .map(p => p.platform?.name)
                    .filter(Boolean)
                    .join(", ") || "-"}
                </span>
              </div>
            </div>
          </aside>
        </section>
      </main>

      <Footer />
    </>
  );
}
