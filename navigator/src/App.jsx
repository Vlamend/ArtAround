import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import VisitList from './pages/VisitList.jsx';
import NavigatorPlayer from './pages/NavigatorPlayer.jsx';
import Settings from './pages/Settings.jsx';
import { getToken, getMe, clearToken, getConfig, getMuseumBySlug } from './api.js';
import { clearMuseumTheme, applyMuseumTheme} from './theme.js';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [stillLoading, setLoading] = useState(true);

  const [museum, setMuseum] = useState(null);
  const [museumStatus, setMuseumStatus] = useState('idle');

  // Controlla se l'utente è loggato al caricamento dell'app
  useEffect(() => {
    async function checkLogin() {
      const token = getToken();
      if (!token) {
        setIsLoggedIn(false);
        setLoading(false);
        return;
      }
      try {
        await getMe();
        setIsLoggedIn(true);
      } catch {
        clearToken();
        setIsLoggedIn(false);
      }finally {
        setLoading(false);
      }
    }
    checkLogin();
  }, []);

  useEffect(() => {
      if (!isLoggedIn) return;

      setMuseumStatus('loading');
      getConfig()
        .then(config => getMuseumBySlug(config.museumSlug))
        .then(data => {
          setMuseum(data);
          applyMuseumTheme(data);
          setMuseumStatus('ready');
        })
        .catch(() => setMuseumStatus('error'));
  }, [isLoggedIn]);

  // Mostra un messaggio di caricamento mentre si verifica lo stato di login
  if (stillLoading) {
    return (<div className="screen">
      <p className="status-message">Loading...</p>
      </div>
    );
  }

  function MuseumGate({ status, children }) {
    if (status === 'loading' || status === 'idle') {
      return <div className="screen"><p className="status-message">Caricamento museo…</p></div>;
    }
    if (status === 'error') {
      return (
        <div className="screen">
          <p className="error-message">
            Impossibile determinare il museo di questa app. Verifica museum.config.json sul server.
          </p>
        </div>
      );
    }
    return children;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={< Navigate to="/visits" />}/>

        <Route 
        path="/login" 
        element={!isLoggedIn ? 
        <Login onLogin={() => setIsLoggedIn(true)} /> : <Navigate to="/visits" replace/>}/>
        
        <Route
        path="/settings"
        element={isLoggedIn ? 
        <Settings /> : <Navigate to="/login" replace />}
        />

        <Route 
        path="/visits" 
        element={isLoggedIn ? (
          <MuseumGate status={museumStatus}>
            <VisitList
              museum={museum}
              onLogout={() => {
                clearMuseumTheme();
                setMuseum(null);
                setMuseumStatus('idle');
                setIsLoggedIn(false);
              }}
            />
          </MuseumGate>
        ) : <Navigate to="/login" replace/>}/> 
        
        <Route 
        path="/visits/:visitId" 
        element={isLoggedIn ? <NavigatorPlayer /> : <Navigate to="/login" replace/>}/> 
      </Routes>
    </BrowserRouter>
  );
}
