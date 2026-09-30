import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import VisitList from './pages/VisitList.jsx';
import NavigatorPlayer from './pages/NavigatorPlayer.jsx';
import Settings from './pages/Settings.jsx';
import Signup from './pages/Signup.jsx';
import { getToken, getMe, clearToken, getConfig, getMuseumBySlug } from './api.js';
import { applyMuseumTheme, initDarkMode } from './theme.js';

/*
 * Componente radice: carica lo stato iniziale e definisce le route.
 * Route pubbliche solo se non si è loggati: /login e /signup.
 * Route protette (reindirizzano a /login se non si è loggati):
 * /settings, /visits e /visits/:visitId.
 */
export default function App() {
  // Stato del login e del caricamento iniziale
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [stillLoading, setLoading] = useState(true);

  // Museo di questa installazione (scelto dalla config del server) e stato del suo caricamento:
  // 'idle' | 'loading' | 'ready' | 'error'
  const [museum, setMuseum] = useState(null);
  const [museumStatus, setMuseumStatus] = useState('idle');

  /*
   * All'avvio dell'app:
   * 1. Imposta la modalità chiara/scura.
   * 2. Chiede al server la config, poi il museo indicato dal suo slug,
   * e ne applica i colori. Se fallisce museumStatus diventa 'error'.
   * 3. Se nel localStorage c'è un token lo verifica con getMe():
   * se il server lo rifiuta lo elimina e l'utente risulta non loggato.
   */
  useEffect(() => {
    async function checkLogin() {
      initDarkMode();
      setMuseumStatus('loading');
      getConfig()
        .then(config => getMuseumBySlug(config.museumSlug))
        .then(data => {
          setMuseum(data);
          applyMuseumTheme(data);
          setMuseumStatus('ready');
        })
        .catch(() => setMuseumStatus('error'));
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
      } finally {
        setLoading(false);
      }
    }
    checkLogin();
  }, []);

  // Finché non si sa se l'utente è loggato mostra solo un messaggio di caricamento
  if (stillLoading) {
    return (<div className="screen">
      <p className="status-message">Loading...</p>
    </div>
    );
  }

  // Mostra i figli solo quando il museo è stato caricato, altrimenti un messaggio di attesa o di errore
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
        <Route path="/" element={< Navigate to="/visits" />} />

        <Route
          path="/login"
          element={!isLoggedIn ?
            <Login onLogin={() => setIsLoggedIn(true)} /> : <Navigate to="/visits" replace />} />

        <Route
          path="/signup"
          element={!isLoggedIn ?
            <Signup onSignup={() => setIsLoggedIn(true)} /> : <Navigate to="/visits" replace />} />

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
                  setIsLoggedIn(false);
                }}
              />
            </MuseumGate>
          ) : <Navigate to="/login" replace />} />

        <Route
          path="/visits/:visitId"
          element={isLoggedIn ? <NavigatorPlayer /> : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
