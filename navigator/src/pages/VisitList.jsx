import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getVisits, logout, getMe } from '../api.js';
import './VisitList.css';

export default function VisitList({ museum, onLogout }) {
  const [visits, setVisits] = useState([]);
  const [visitedIds, setVisitedIds] = useState(new Set());
  const [status, setStatus] = useState('loading');
  const navigate = useNavigate();

  useEffect(() => {
    if (!museum?._id) return;

    Promise.all([getVisits(museum._id), getMe()])
      .then(([visitsData, meData]) => {
        setVisits(visitsData);
        const ids = new Set((meData.user.visitedVisits ?? []).map(v => v.visit));
        setVisitedIds(ids);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [museum]);

  function handleLogout() {
    logout();
    onLogout();
  }

  return (
    <div className="screen">
      <div className="top-bar">
        <p className="eyebrow">{museum?.name}</p>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link to="/settings" className="text-link" style={{ textDecoration: 'none' }}>Impostazioni</Link>
          <button className="text-link" onClick={handleLogout}>Esci</button>
        </div>
      </div>
      <h1>Scegli la visita</h1>

      {status === 'loading' && <p className="status-message">Caricamento visite…</p>}
      {status === 'error' && <p className="error-message">Non riesco a caricare le visite. Riprova più tardi.</p>}
      {status === 'ready' && visits.length === 0 && (
        <p className="status-message">Nessuna visita disponibile per questo museo.</p>
      )}

      <ul className="visit-list">
        {visits.map(v => (
          <li key={v._id}>
            <button className="visit-card" onClick={() => navigate(`/visits/${v._id}`)}>
              <span className="visit-card-title">
                {v.title}
                {visitedIds.has(v._id) && <span className="visited-badge">Già visitata</span>}
              </span>
              {v.description && <span className="visit-card-desc">{v.description}</span>}
              <span className="visit-card-meta">{v.steps?.length ?? 0} tappe</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
