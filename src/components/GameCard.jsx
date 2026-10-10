import { Link } from 'react-router-dom';
import { Star, Heart, Sparkles, Calendar, Monitor, GitBranch, ShieldCheck } from 'lucide-react'; 

export default function GameCard({ game, isPersonalized = false, isSaved = false, kgReason = "" }) {
  const platforms = (game.platforms || [])
    .slice(0, 3)
    .map(p => p.platform?.name)
    .filter(Boolean)
    .join(" • ");

  const esrbRating = game.esrb_rating?.name || "NR";

  return (
    <Link to={`/game/${game.id}`} className="card">
      <div className="cover-wrap">
        <img 
          className="cover"
          src={game.background_image || "https://via.placeholder.com/500x700/111528/ffffff?text=No+Image"}
          alt={game.name}
          loading="lazy"
        />
        <div className="cover-overlay"></div>
        
        {isPersonalized && (
          <div className="personalized-badge">
            <Sparkles size={12} />
            <span>Recommended</span>
          </div>
        )}

        <div className="card-top-badges">
          {/* BARU: Badge ESRB Rating */}
          <div className="esrb-badge" title={`ESRB Rating: ${esrbRating}`}>
            <ShieldCheck size={12} />
            <span>{esrbRating}</span>
          </div>

          {isSaved && (
            <div className="saved-badge" title="Saved to your Pod">
              <Heart size={14} fill="currentColor" />
            </div>
          )}
          <div className="rating-badge">
            <Star size={12} fill="currentColor" />
            <span>{game.rating ?? "-"}</span>
          </div>
        </div>

        {isPersonalized && kgReason && (
          <div className="kg-reason-badge">
            <GitBranch size={12} className="text-primary" />
            {kgReason}
          </div>
        )}
      </div>
      
      <div className="card-body">
        <div className="title">{game.name}</div>
        <div className="meta">
          <span className="meta-item">
            <Calendar size={12} />
            {game.released ? new Date(game.released).getFullYear() : "TBA"}
          </span>
          {platforms && (
            <span className="meta-item">
              <Monitor size={12} />
              {platforms}
            </span>
          )}
        </div>
        <div className="tags">
          {(game.genres || []).slice(0, 3).map((g, i) => (
            <span key={i} className="tag">{g.name}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}