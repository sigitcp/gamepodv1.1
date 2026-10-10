import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { getDefaultSession, logout, handleIncomingRedirect } from '@inrupt/solid-client-authn-browser';
import { getSolidDataset, getThing, getStringNoLocale } from '@inrupt/solid-client';
import { fetchGenres } from '../services/rawgApi';
import { saveSessionToPod } from '../services/solidPod'; 
import { 
  Search, X, Sparkles, LayoutDashboard, LogOut, LogIn, 
  Filter, SlidersHorizontal, Menu, ChevronDown 
} from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = getDefaultSession();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('User');
  const [allGenres, setAllGenres] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const dropdownRef = useRef(null);
  const filterDebounceRef = useRef(null); // Debounce timer for filter changes
  const lastSavedFilterRef = useRef(''); // Track last saved filter state to avoid duplicates

  const currentSearch = searchParams.get('search') || '';
  const currentGenre = searchParams.get('genre') || '';
  const currentOrdering = searchParams.get('ordering') || '-rating';
  const [searchInput, setSearchInput] = useState(currentSearch);

  const isHome = location.pathname === '/';

  // Close dropdown if user clicks outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function init() {
      await handleIncomingRedirect({ url: window.location.href, restorePreviousSession: true });
      
      if (session.info.isLoggedIn && session.info.webId) {
        setIsLoggedIn(true);
        
        try {
          const profileDataset = await getSolidDataset(session.info.webId, { fetch: session.fetch });
          const profileThing = getThing(profileDataset, session.info.webId);
          
          const podName = 
            getStringNoLocale(profileThing, 'http://xmlns.com/foaf/0.1/name') || 
            getStringNoLocale(profileThing, 'http://www.w3.org/2006/vcard/ns#fn');
          
          if (podName) {
            setUserName(podName);
          } else {
            const url = new URL(session.info.webId);
            const hostnameParts = url.hostname.split('.');
            let extractedName = 'User';

            if (hostnameParts.length > 2 && !['www', 'pods'].includes(hostnameParts[0])) {
              extractedName = hostnameParts[0];
            } else {
              const pathParts = url.pathname.split('/').filter(p => p.length > 0);
              const namePart = pathParts.find(p => p !== 'profile' && p !== 'card' && !p.includes('#'));
              if (namePart) extractedName = namePart;
            }
            setUserName(extractedName);
          }
        } catch (err) {
          console.warn('Failed to read Pod profile, using fallback:', err);
          setUserName('User');
        }
      }
      
      try {
        const data = await fetchGenres();
        setAllGenres(data.results || []);
      } catch (err) {
        console.warn('Failed to load genres:', err);
      }
    }
    init();
  }, [session]);

  // =========================================================
  // SAVE SEARCH/FILTER TO SOLID POD (sessions.ttl)
  // =========================================================
  const saveToPod = async (query, genre, ordering) => {
    if (!session.info.isLoggedIn || !session.info.webId) return;
    
    // Skip if no meaningful data to save
    if (!query && !genre && ordering === '-rating') return;

    try {
      const sessionId = `search-session-${Date.now()}`;
      const genresArray = genre ? [genre] : [];
      
      await saveSessionToPod(session, sessionId, query || `Filter: ${genre || ordering}`, genresArray, []);
      console.log(`✅ Session saved to sessions.ttl: query="${query}", genre="${genre}", ordering="${ordering}"`);
    } catch (err) {
      console.warn('Failed to save session to Pod:', err);
    }
  };

  // =========================================================
  // DEBOUNCED FILTER SAVE (Prevents spam on rapid filter changes)
  // =========================================================
  useEffect(() => {
    if (!isHome) return; // Only track filters on Home page

    // Create a unique key representing current filter state
    const filterStateKey = `${currentGenre}|${currentOrdering}`;
    
    // Skip if this is the same filter state we last saved
    if (filterStateKey === lastSavedFilterRef.current) return;
    
    // Skip the initial default state on mount
    if (!currentGenre && currentOrdering === '-rating' && !currentSearch) {
      lastSavedFilterRef.current = filterStateKey;
      return;
    }

    // Clear any pending debounce timer
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }

    // Set new debounce timer (save after 1.5s of filter inactivity)
    filterDebounceRef.current = setTimeout(() => {
      saveToPod(currentSearch, currentGenre, currentOrdering);
      lastSavedFilterRef.current = filterStateKey;
    }, 1500);

    return () => {
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
      }
    };
  }, [currentGenre, currentOrdering, currentSearch, isHome]);

  const handleLogout = async () => {
    await logout();
    setIsLoggedIn(false);
    setUserName('User');
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    navigate('/login');
  };

  // =========================================================
  // SEARCH SUBMIT: Immediate save to sessions.ttl
  // =========================================================
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const keyword = searchInput.trim();
    const params = new URLSearchParams(searchParams);

    if (keyword) {
      params.set('search', keyword);
      
      // IMMEDIATELY save the search action to sessions.ttl
      saveToPod(keyword, currentGenre, currentOrdering);
    } else {
      params.delete('search');
    }

    setSearchParams(params);
    setIsMobileMenuOpen(false);
  };

  const handleFilterChange = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== '-rating') params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
    setIsMobileMenuOpen(false);
    // Note: Saving to Pod is handled by the debounced useEffect above
  };

  const clearAllFilters = () => {
    setSearchInput('');
    setSearchParams({});
    lastSavedFilterRef.current = ''; // Reset tracking
  };

  const hasActiveFilters = currentSearch || currentGenre || currentOrdering !== '-rating';

  return (
    <header className="site-header">
      <nav className="navbar">
        {/* 1. Logo */}
        <Link className="logo" to="/" onClick={() => setIsMobileMenuOpen(false)}>
          <span></span>Game<span>Pod</span>
        </Link>

        {/* 2. Mobile Menu Toggle */}
        <button 
          className="mobile-menu-toggle" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* 3. Collapsible Content */}
        <div className={`navbar-content ${isMobileMenuOpen ? 'open' : ''}`}>
          
          {/* Search & Filter: ONLY appears on Home */}
          {isHome && (
            <>
              <form onSubmit={handleSearchSubmit} className="navbar-search">
                <Search size={16} className="search-icon-left" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search games..."
                />
                {searchInput && (
                  <button type="button" className="search-clear" onClick={() => setSearchInput('')}>
                    <X size={14} />
                  </button>
                )}
              </form>

              <div className="nav-filters">
                <div className="filter-wrapper">
                  <Filter size={14} className="filter-icon" />
                  <select
                    className="nav-filter-select"
                    value={currentGenre}
                    onChange={(e) => handleFilterChange('genre', e.target.value)}
                  >
                    <option value="">All Genres</option>
                    {allGenres.map(g => <option key={g.id} value={g.slug}>{g.name}</option>)}
                  </select>
                </div>

                <div className="filter-wrapper">
                  <SlidersHorizontal size={14} className="filter-icon" />
                  <select
                    className="nav-filter-select"
                    value={currentOrdering}
                    onChange={(e) => handleFilterChange('ordering', e.target.value)}
                  >
                    <option value="-rating">Highest Rating</option>
                    <option value="-released">Newest</option>
                    <option value="-added">Recently Added</option>
                    <option value="name">Name (A-Z)</option>
                    <option value="-metacritic">Metacritic</option>
                  </select>
                </div>

                {hasActiveFilters && (
                  <button className="nav-clear-filter" onClick={clearAllFilters} title="Reset filters">
                    <X size={14} />
                  </button>
                )}
              </div>
            </>
          )}

          {/* User Actions */}
          <div className="nav-actions">
            {isLoggedIn ? (
              <>
                <Link to="/vibe-search" className="nav-action-btn" onClick={() => setIsMobileMenuOpen(false)}>
                  <Sparkles size={16} />
                  <span className="d-none d-xl-inline">Vibe Search</span>
                </Link>
                <Link to="/dashboard" className="nav-action-btn" onClick={() => setIsMobileMenuOpen(false)}>
                  <LayoutDashboard size={16} />
                  <span className="d-none d-xl-inline">Dashboard</span>
                </Link>
                
                {/* USER DROPDOWN MENU */}
                <div className="user-dropdown-container" ref={dropdownRef}>
                  <button 
                    className="user-dropdown-trigger" 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="true"
                  >
                    <div className="user-avatar">{userName.charAt(0).toUpperCase()}</div>
                    <span className="user-name">{userName}</span>
                    <ChevronDown size={16} className={`dropdown-chevron ${isUserMenuOpen ? 'rotate' : ''}`} />
                  </button>

                  {isUserMenuOpen && (
                    <div className="user-dropdown-menu">
                      <div className="dropdown-header">
                        <span className="dropdown-username" title={userName}>{userName}</span>
                      </div>
                      <button onClick={handleLogout} className="dropdown-logout-btn">
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link to="/login" className="primary-btn login-btn" onClick={() => setIsMobileMenuOpen(false)}>
                <LogIn size={16} /> Login
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}