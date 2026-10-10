import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDefaultSession } from '@inrupt/solid-client-authn-browser';
import { fetchGenres } from '../services/rawgApi';
import { saveSettingsToPod } from '../services/solidPod'; 

export default function Onboarding() {
  const navigate = useNavigate();
  const session = getDefaultSession();
  const webId = session.info.webId; 

  const [genres, setGenres] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [birthDate, setBirthDate] = useState(''); 
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Route protection: Redirect to login if not logged in
    if (!session.info.isLoggedIn) {
      navigate('/login');
      return;
    }

    async function loadGenres() {
      try {
        const data = await fetchGenres();
        setGenres(data.results || []);
      } catch (err) {
        console.error('Failed to load genres:', err);
        setError('Failed to load genre list from RAWG.');
      } finally {
        setIsLoading(false);
      }
    }
    loadGenres();
  }, [session, navigate]);

  const toggleGenre = (genreId, genreName) => {
    if (selectedGenres.find(g => g.id === genreId)) {
      setSelectedGenres(selectedGenres.filter(g => g.id !== genreId));
    } else {
      if (selectedGenres.length < 5) {
        setSelectedGenres([...selectedGenres, { id: genreId, name: genreName }]);
      } else {
        alert('Maximum 5 genres can be selected!');
      }
    }
  };

  const handleSave = async () => {
    if (selectedGenres.length < 3) {
      alert('Please select at least 3 genres to continue.');
      return;
    }
    if (!birthDate) {
      alert('Please enter your date of birth to ensure age-appropriate recommendations.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Pass both selectedGenres and birthDate to the save function
      await saveSettingsToPod(session, selectedGenres, birthDate);
      console.log('✅ Successfully saved to Pod, redirecting to Home...');
      navigate('/');
    } catch (err) {
      console.error('Failed to save to Pod:', err);
      setError('Failed to save preferences to Solid Pod. Please ensure you granted Write Access during login.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container" style={{ marginTop: '50px', textAlign: 'center' }}>
        <div className="loading">Loading genre list...</div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '800px', marginTop: '40px' }}>
      <div className="panel">
        <h2>🎮 Set Up Your Game Preferences</h2>
        <p className="muted">
          Select between 3 and 5 game genres you enjoy the most, and provide your date of birth. 
          This data will be securely stored and encrypted in your <strong>Solid Pod</strong> to ensure age-appropriate recommendations.
        </p>
        
        {error && (
          <div className="error" style={{ marginBottom: '15px', padding: '10px', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        {/* Date of Birth Input */}
        <div className="form-group-dob">
          <label htmlFor="birthDate" className="form-label-dob">
            Date of Birth (For Age-Appropriate Filtering)
          </label>
          <input
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
            max={new Date().toISOString().split("T")[0]} 
            className="form-input-dob"
          />
          <span className="form-hint-dob">
            Your birth date is stored securely in your Solid Pod and used only to filter age-appropriate content.
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', margin: '20px 0' }}>
          {genres.map(genre => {
            const isSelected = selectedGenres.find(g => g.id === genre.id);
            return (
              <button
                key={genre.id}
                onClick={() => toggleGenre(genre.id, genre.name)}
                className={isSelected ? 'primary-btn' : 'ghost-btn'}
                style={{ 
                  border: isSelected ? 'none' : '1px solid #ccc',
                  backgroundColor: isSelected ? '#646cff' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--text, #333)',
                  cursor: 'pointer',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s'
                }}
              >
                {genre.name} {isSelected && '✓'}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px' }}>
          <span className="muted">{selectedGenres.length} / 5 genres selected</span>
          <button 
            className="primary-btn" 
            onClick={handleSave}
            disabled={isSaving || selectedGenres.length < 3 || !birthDate}
            style={{ opacity: (isSaving || selectedGenres.length < 3 || !birthDate) ? 0.6 : 1 }}
          >
            {isSaving ? 'Saving to Solid Pod...' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}