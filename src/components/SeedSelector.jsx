import { useState, useEffect } from 'react';
import { searchGamesForSeed } from '../services/rawgApi';
import { Search, Loader2, Plus, X, Target, Star } from 'lucide-react';

export default function SeedSelector({ selectedSeeds, onSeedsChange, maxSeeds = 3 }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        const results = await searchGamesForSeed(searchQuery, 8);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 400); // Debounce 400ms

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addSeed = (game) => {
    if (selectedSeeds.length >= maxSeeds) {
      alert(`Maximum ${maxSeeds} seed games can be selected.`);
      return;
    }
    if (selectedSeeds.find(s => s.id === game.id)) {
      return;
    }
    onSeedsChange([...selectedSeeds, game]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeSeed = (gameId) => {
    onSeedsChange(selectedSeeds.filter(s => s.id !== gameId));
  };

  return (
    <div className="seed-selector-wrapper">
      <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Target size={14} />
        Select up to {maxSeeds} games as "anchors" for more personalized recommendations.
      </p>

      {/* Search Input */}
      <div className="seed-search-container">
        <Search size={16} className="seed-search-icon" />
        <input
          type="text"
          className="seed-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for seed games... (e.g., Hades, Elden Ring)"
        />
        {isSearching && (
          <Loader2 size={16} className="seed-search-spinner spinning" />
        )}
      </div>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <div className="seed-results-dropdown custom-scroll">
          {searchResults.map(game => (
            <div
              key={game.id}
              className="seed-result-item"
              onClick={() => addSeed(game)}
            >
              <img
                src={game.background_image || 'https://via.placeholder.com/56x40/111528/ffffff?text=?'}
                alt={game.name}
                className="seed-result-image"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/56x40/111528/ffffff?text=?'; }}
              />
              <div className="seed-result-info">
                <div className="seed-result-title">{game.name}</div>
                <div className="seed-result-meta">
                  {(game.genres || []).slice(0, 2).map(g => g.name).join(' • ')}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Star size={11} fill="#facc15" color="#facc15" />
                    {game.rating || '-'}
                  </span>
                </div>
              </div>
              <div className="seed-result-add">
                <Plus size={14} />
                Add
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Seeds Chips */}
      {selectedSeeds.length > 0 && (
        <div className="seed-chips-container">
          <div className="seed-chips-header">
            <span>Selected Seeds ({selectedSeeds.length}/{maxSeeds}):</span>
          </div>
          <div className="seed-chips-list">
            {selectedSeeds.map(seed => (
              <div key={seed.id} className="seed-chip">
                <span>{seed.name}</span>
                <button
                  className="seed-chip-remove"
                  onClick={() => removeSeed(seed.id)}
                  title="Remove seed"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}