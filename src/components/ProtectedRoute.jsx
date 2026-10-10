import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getDefaultSession } from '@inrupt/solid-client-authn-browser';

export default function ProtectedRoute({ children }) {
  const session = getDefaultSession();
  const location = useLocation();

  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Beri sedikit waktu agar session Solid selesai tersedia
    const timer = setTimeout(() => {
      setIsChecking(false);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  if (isChecking) {
    return (
      <div
        className="container"
        style={{
          marginTop: '100px',
          textAlign: 'center'
        }}
      >
        <div className="loading">
          🔄 Validating Solid Pod Session...
        </div>
      </div>
    );
  }

  if (!session.info.isLoggedIn) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return children;
}