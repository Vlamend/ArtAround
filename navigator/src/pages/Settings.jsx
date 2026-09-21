import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMe, updateMe } from '../api.js';

const DOMAIN_LABELS = {
  artista: "Storia dell'artista",
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
  const [saveStatus, setSaveStatus] = useState('idle');

  useEffect(() => {
    getMe()
      .then(data => {
        setPreferredLanguageLevel(
          data.user.preferredLanguageLevel ?? 'medio'
        );

        setInterestWeights(
          data.user.interestWeights ?? {}
        );

        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaveStatus('saving');

    try {
      await updateMe({
        preferredLanguageLevel,
        interestWeights
      });

      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center px-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Caricamento…
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center px-4">
        <p className="text-sm text-red-600 dark:text-red-400">
          Non riesco a caricare le impostazioni.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-neutral-900 dark:text-white">

      {/* NAVBAR */}
      <nav
        className="
          relative z-20
          min-h-17
          border-b border-slate-300
          bg-white
          px-4 py-2
          dark:border-neutral-700
          dark:bg-neutral-900
          md:px-8
        "
        aria-label="Main navigation"
      >
        <div className="mx-auto flex w-full max-w-7xl items-center">
          <Link
            to="/visits"
            className="
              rounded
              text-sm font-medium
              text-slate-700
              transition-colors
              hover:text-violet-700
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-violet-500
              dark:text-slate-300
              dark:hover:text-violet-400
            "
          >
            ← Torna alle visite
          </Link>
        </div>
      </nav>

      {/* CONTENT */}
      <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-12">

        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Impostazioni
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Personalizza il modo in cui il Navigator adatta i contenuti
            durante le tue visite.
          </p>
        </div>

        <form
          onSubmit={handleSave}
          className="flex flex-col gap-8"
        >

          {/* LANGUAGE LEVEL */}
          <section
            className="
              rounded-xl
              border border-slate-200
              bg-white
              p-5
              shadow-sm
              dark:border-neutral-700
              dark:bg-neutral-800/50
            "
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Livello linguistico
              </h2>

              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">
                Scegli il livello di complessità dei contenuti che preferisci.
              </p>
            </div>

            <label
              htmlFor="language-level"
              className="flex flex-col gap-2"
            >
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Livello linguistico preferito
              </span>

              <select
                id="language-level"
                value={preferredLanguageLevel}
                onChange={e => setPreferredLanguageLevel(e.target.value)}
                className="
                  w-full
                  rounded-lg
                  border border-slate-300
                  bg-white
                  px-3 py-2.5
                  text-sm
                  text-slate-900
                  shadow-sm
                  outline-none
                  transition
                  focus:border-violet-500
                  focus:ring-2
                  focus:ring-violet-500/20
                  dark:border-neutral-600
                  dark:bg-neutral-800
                  dark:text-white
                  dark:focus:border-violet-400
                  dark:focus:ring-violet-400/20
                "
              >
                {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <span className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                Il Navigator proverà a mostrarti i contenuti a questo livello,
                quando disponibili.
              </span>
            </label>
          </section>

          {/* INTERESTS */}
          <section
            className="
              rounded-xl
              border border-slate-200
              bg-white
              p-5
              shadow-sm
              dark:border-neutral-700
              dark:bg-neutral-800/50
            "
          >
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                I tuoi interessi
              </h2>

              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">
                Aumentano automaticamente quando dai 👍 a un contenuto
                durante la visita, ma puoi anche impostarli manualmente.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {Object.entries(DOMAIN_LABELS).map(([domain, label]) => (
                <label
                  key={domain}
                  htmlFor={domain}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {label}
                    </span>

                    <span className="min-w-8 rounded-md bg-slate-100 px-2 py-1 text-center text-xs font-semibold text-slate-700 dark:bg-neutral-700 dark:text-slate-200">
                      {interestWeights[domain] ?? 0}
                    </span>
                  </div>

                  <input
                    id={domain}
                    type="range"
                    value={interestWeights[domain] ?? 0}
                    min="-10"
                    max="10"
                    step="1"
                    onChange={e =>
                      setInterestWeights(w => ({
                        ...w,
                        [domain]: Number(e.target.value)
                      }))
                    }
                    className="
                      h-2
                      w-full
                      cursor-pointer
                      appearance-none
                      rounded-lg
                      bg-slate-200
                      accent-violet-600
                      outline-none
                      focus-visible:ring-2
                      focus-visible:ring-violet-500
                      dark:bg-neutral-700

                      [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-violet-700

                      [&::-moz-range-thumb]:h-4
                      [&::-moz-range-thumb]:w-4
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:bg-violet-600
                    "
                  />

                  <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500">
                    <span>−10</span>
                    <span>Neutrale</span>
                    <span>+10</span>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* STATUS */}
          {saveStatus === 'saved' && (
            <div
              className="
                rounded-lg
                border border-green-200
                bg-green-50
                px-4 py-3
                text-sm text-green-700
                dark:border-green-900
                dark:bg-green-950/40
                dark:text-green-400
              "
              role="status"
            >
              Preferenze salvate.
            </div>
          )}

          {saveStatus === 'error' && (
            <div
              className="
                rounded-lg
                border border-red-200
                bg-red-50
                px-4 py-3
                text-sm text-red-700
                dark:border-red-900
                dark:bg-red-950/40
                dark:text-red-400
              "
              role="alert"
            >
              Non riesco a salvare le preferenze.
            </div>
          )}

          {/* SAVE BUTTON */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saveStatus === 'saving'}
              className="
                rounded-lg
                bg-violet-700
                px-5 py-2.5
                text-sm font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-violet-800
                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-violet-500
                focus-visible:ring-offset-2
                disabled:cursor-not-allowed
                disabled:opacity-50
                dark:bg-violet-600
                dark:hover:bg-violet-700
                dark:focus-visible:ring-offset-neutral-900
              "
            >
              {saveStatus === 'saving'
                ? 'Salvataggio…'
                : 'Salva preferenze'}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}