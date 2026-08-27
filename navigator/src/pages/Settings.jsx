import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMe, updateMe } from '../api.js';
import './Settings.css';

const DOMAIN_LABELS = {
  artista: 'Storia dell\'artista',
  architettura: 'Abbigliamento e architettura',
  stile: 'Stile, colori e layout',
  materiali: 'Materiali e tecnica',
  storia: 'Eventi storici'
};

const LANGUAGE_LABELS = {
  infantile: 'Infantile',
  elementare: 'Elementare',
  medio: 'Medio',
  specialistico: 'Specialistico'
};

export default function Settings() {
  const [status, setStatus] = useState('loading');
  const [preferredLanguageLevel, setPreferredLanguageLevel] = useState('medio');
  const [interestWeights, setInterestWeights] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error

  useEffect(() => {
    getMe()
      .then(data => {
        setPreferredLanguageLevel(data.user.preferredLanguageLevel ?? 'medio');
        setInterestWeights(data.user.interestWeights ?? {});
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaveStatus('saving');
    try {
      await updateMe({ preferredLanguageLevel, interestWeights });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  if (status === 'loading') return <div className="screen"><p className="status-message">Caricamento…</p></div>;
  if (status === 'error') return <div className="screen"><p className="error-message">Non riesco a caricare le impostazioni.</p></div>;

  return (
    <div className="screen">
      <Link to="/visits" className="back-link">&larr; Torna alle visite</Link>
      <h1>Impostazioni</h1>

      <form onSubmit={handleSave} className="settings-form">
        <label>
          Livello linguistico preferito
          <select value={preferredLanguageLevel} onChange={e => setPreferredLanguageLevel(e.target.value)}>
            {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <span className="status-message settings-hint">
            Il Navigator proverà a mostrarti i contenuti a questo livello, quando disponibili.
          </span>
        </label>

        <h2>I tuoi interessi</h2>
        <p className="status-message">
          Aumentano automaticamente quando dai 👍 a un contenuto durante la visita, ma puoi anche impostarli qui a mano.
        </p>

        {Object.entries(DOMAIN_LABELS).map(([domain, label]) => (
          <label key={domain} className="interest-row">
            {label}
            <input
              type="range"
              min="-10"
              max="10"
              value={interestWeights[domain] ?? 0}
              onChange={e => setInterestWeights(w => ({ ...w, [domain]: Number(e.target.value) }))}
            />
            <span className="interest-value">{interestWeights[domain] ?? 0}</span>
          </label>
        ))}

        {saveStatus === 'saved' && <p className="status-message">Preferenze salvate.</p>}
        {saveStatus === 'error' && <p className="error-message">Non riesco a salvare le preferenze.</p>}

        <button type="submit" disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? 'Salvataggio…' : 'Salva preferenze'}
        </button>
      </form>
    </div>
  );
}