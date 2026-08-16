import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVisits, logout } from '../api.js';
import './VisitList.css';

export default function VisitList({ museum, onLogout }) {
  const [visits, setVisits] = useState([]);
  const [status, setStatus] = useState('loading');
  const navigate = useNavigate();

  useEffect(() => {
    if (!museum?._id) return;
    getVisits(museum._id)
      .then(data => {
        setVisits(data);
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
        <button className="logout-link" onClick={handleLogout}>Esci</button>
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
              <span className="visit-card-title">{v.title}</span>
              {v.description && <span className="visit-card-desc">{v.description}</span>}
              <span className="visit-card-meta">{v.steps?.length ?? 0} tappe</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
