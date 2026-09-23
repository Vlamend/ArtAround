import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMe, updateMe } from '../api.js';
import { toggleDarkMode } from '../theme.js';

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
    <div className="min-h-screen bg-white text-slate-900 dark:bg-neutral-900 dark:text-white transition-colors duration-300">

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
        <div className="mx-auto flex w-full max-w-7xl justify-between items-center">
          <Link
            to="/visits"
            className="
              rounded
              text-sm font-medium
              text-slate-700
              transition-colors
              hover:text-primary
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-primary
              dark:text-slate-300
              dark:hover:text-secondary
            "
          >
            ← Torna alle visite
          </Link>
        
        <button
  type="button"
  onClick={toggleDarkMode}
  aria-label="Cambia tema"
  title="Cambia tema"
  className="
    relative
    h-7 w-12
    cursor-pointer
    rounded-full
    bg-slate-300
    transition-colors
    dark:bg-neutral-700
    focus:outline-none
    focus-visible:ring-2
    focus-visible:ring-primary
    dark:focus-visible:ring-secondary
  "
>
  <span
    className="
      absolute left-1 top-1
      flex h-5 w-5
      items-center justify-center
      rounded-full
      bg-white
      dark:bg-gray-800
      text-xs
      shadow-sm
      transition-transform
      
      dark:translate-x-5
    "
    aria-hidden="true"
  >
    <span className="dark:hidden">
      <svg className="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
    </span>
    <span className="hidden dark:inline">
      <svg className="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
    </span>
  </span>
</button>
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
                  focus:border-primary
                  focus:ring-2
                  focus:ring-primary/20
                  dark:border-neutral-600
                  dark:bg-neutral-800
                  dark:text-white
                  dark:focus:border-secondary
                  dark:focus:ring-secondary/20
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
                      accent-primary
                      outline-none
                      focus-visible:ring-2
                      focus-visible:ring-primary
                      dark:bg-neutral-700
                      dark:accent-secondary
                      dark:focus-visible:ring-secondary

                      [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-primary
                      [&::-webkit-slider-thumb]:dark:bg-secondary

                      [&::-moz-range-thumb]:h-4
                      [&::-moz-range-thumb]:w-4
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:bg-primary
                      [&::-moz-range-thumb]:dark:bg-secondary
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
                text-sm text-primary
                dark:border-secondary
                dark:bg-secondary/40
                dark:text-secondary
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
                bg-primary
                px-5 py-2.5
                text-sm font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-primary/90
                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-primary
                focus-visible:ring-offset-2
                disabled:cursor-not-allowed
                disabled:opacity-50
                dark:bg-secondary/55
                dark:hover:bg-secondary/90
                dark:focus-visible:ring-offset-neutral-900
                cursor-pointer
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