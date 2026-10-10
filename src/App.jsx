import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Detail from './pages/Detail';
import Dashboard from './pages/Dashboard';
import VibeSearch from './pages/VibeSearch';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:id" element={<Detail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/vibe-search" element={
          <ProtectedRoute>
            <VibeSearch />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
