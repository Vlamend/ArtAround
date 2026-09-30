import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getVisits, logout, getMe } from '../api.js';

/*
 * Pagina con le visite del museo, tra cui l'utente sceglie quale iniziare.
 * Ha ricerca per titolo, ordinamento, paginazione e un menu con impostazioni e logout.
 * Filtro, ordinamento e paginazione sono fatti nel browser sull'elenco già scaricato.
 */
export default function VisitList({ museum, onLogout }) {
   // Tutte le visite scaricate e gli id di quelle già completate dall'utente
   const [visits, setVisits] = useState([]);
   const [visitedIds, setVisitedIds] = useState(new Set());
   const [status, setStatus] = useState('loading');
   const [isMenuOpen, setIsMenuOpen] = useState(false);
   // Paginazione: quante visite per pagina e pagina corrente (parte da 1)
   const [visitsOnScreen, setVisitsOnScreen] = useState(3);
   const [actualPage, setActualPage] = useState(1);

   // Testo di ricerca e criterio di ordinamento scelti dall'utente
   const [search, setSearch] = useState('');
   const [sortOrder, setSortOrder] = useState('default');

   // Riferimenti per il menu mobile: il menu stesso e l'elemento che aveva il focus prima di aprirlo
   const menuRef = useRef(null);
   const lastFocusedElementRef = useRef(null);
   const navigate = useNavigate();

   /*
    * Visite da mostrare dopo il filtro e l'ordinamento.
    * 1. Tiene solo quelle il cui titolo contiene il testo cercato (senza distinguere maiuscole).
    * 2. Le ordina per titolo o prezzo secondo sortOrder ('default' mantiene l'ordine del server).
    */
   const filteredVisits = [...visits]
      .filter(v =>
         v.title.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
         switch (sortOrder) {
            case 'title-asc':
               return a.title.localeCompare(b.title);

            case 'title-desc':
               return b.title.localeCompare(a.title);

            case 'price-asc':
               return a.price - b.price;

            case 'price-desc':
               return b.price - a.price;

            default:
               return 0;
         }
      });

   // Calcolo della pagina corrente: numero di pagine, indici della fetta da mostrare e testo "x-y di z"
   const maxPages = Math.ceil(filteredVisits.length / visitsOnScreen);

   const startIndex = (actualPage - 1) * visitsOnScreen;
   const endIndex = startIndex + visitsOnScreen;
   const visibleVisits = filteredVisits.slice(startIndex, endIndex);

   const firstVisible = filteredVisits.length === 0 ? 0 : startIndex + 1;
   const lastVisible = Math.min(endIndex, filteredVisits.length);

   /*
    * Quando il museo è disponibile scarica in parallelo le visite (le pubbliche più
    * le private dell'utente) e il suo profilo (per sapere quali visite ha già completato).
    */
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
   useEffect(() => {
   }, [visits]);
   // Con il menu aperto il tasto Esc lo chiude
   useEffect(() => {
      const handleEscapeKey = (e) => {
         if (e.key === 'Escape' && isMenuOpen) {
            closeMenu();
         }
      };

      document.addEventListener('keydown', handleEscapeKey);

      return () => {
         document.removeEventListener('keydown', handleEscapeKey);
      };
   }, [isMenuOpen]);

   // Cancella il token e avvisa App che l'utente non è più loggato
   function handleLogout() {
      logout();
      onLogout();
   }

   // Apre il menu ricordando dove era il focus, per accessibilità
   const openMenu = () => {
      lastFocusedElementRef.current = document.activeElement;
      setIsMenuOpen(true);

      // Sposta il focus dentro il menu dopo l'aggiornamento dello stato
      setTimeout(() => {
         menuRef.current?.focus();
      }, 0);
   };

   // Chiude il menu e riporta il focus dove si trovava prima
   const closeMenu = () => {
      setIsMenuOpen(false);

      // Ripristina il focus dopo l'aggiornamento dello stato
      setTimeout(() => {
         lastFocusedElementRef.current?.focus();
      }, 0);
   };

   // Pagina precedente (non va sotto la prima)
   function goToPreviousPage() {
      setActualPage(page => Math.max(1, page - 1));
   }

   // Pagina successiva (non va oltre l'ultima)
   function goToNextPage() {
      setActualPage(page => Math.min(maxPages, page + 1));
   }

   return (
      <div className="bg-white dark:bg-neutral-900 dark:text-white min-h-screen">
         <nav
            className="flex py-2 px-4 md:px-8 bg-white border-b border-slate-300 dark:border-neutral-700 dark:bg-neutral-900 min-h-17 relative z-20"
            aria-label="Main navigation"
         >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4 w-full">
               <div className="flex-1 flex">
                  <span className="text-md font-bold">{museum?.name}</span>
               </div>

               <div
                  id="collapseMenu"
                  ref={menuRef}
                  tabIndex={-1}
                  className={`${isMenuOpen ? "w-full" : "w-0"} lg:block max-lg:bg-white transition-all duration-500 ease-in-out dark:max-lg:bg-neutral-900 max-lg:border-l max-lg:border-slate-300 dark:max-lg:border-neutral-700 max-lg:fixed max-lg:top-0 max-lg:right-0 max-lg:h-full max-lg:shadow-md max-lg:overflow-auto  z-50 outline-none`}
               >
                  <div className="py-2 px-4 flex justify-between items-center border-b border-slate-300 sticky top-0 bg-white dark:border-neutral-700 dark:bg-neutral-900 lg:hidden max-lg:min-h-17">
                     <button type="button" aria-controls="collapseMenu"
                        onClick={closeMenu}
                        id="toggleClose"
                        className="cursor-pointer focus:outline-primary dark:focus:outline-secondary focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                     >
                        <span className="sr-only">Chiudi menu</span>
                        <svg
                           xmlns="http://www.w3.org/2000/svg"
                           className="size-4 fill-slate-900 dark:fill-slate-50"
                           aria-hidden="true"
                           viewBox="0 0 329.269 329"
                        >
                           <path
                              d="M194.8 164.77 323.013 36.555c8.343-8.34 8.343-21.825 0-30.164-8.34-8.34-21.825-8.34-30.164 0L164.633 134.605 36.422 6.391c-8.344-8.34-21.824-8.34-30.164 0-8.344 8.34-8.344 21.824 0 30.164l128.21 128.215L6.259 292.984c-8.344 8.34-8.344 21.825 0 30.164a21.27 21.27 0 0 0 15.082 6.25c5.46 0 10.922-2.09 15.082-6.25l128.21-128.214 128.216 128.214a21.27 21.27 0 0 0 15.082 6.25c5.46 0 10.922-2.09 15.082-6.25 8.343-8.34 8.343-21.824 0-30.164zm0 0"
                              data-original="#000000"
                           />
                        </svg>
                     </button>
                  </div>

                  <ul className="flex flex-col gap-8 font-semibold text-sm text-slate-900 dark:text-slate-50 lg:flex-row max-lg:p-6">
                     <li>
                        <Link
                           to="/settings"
                           className="hover:text-primary dark:hover:text-secondary focus:outline-primary dark:focus:outline-secondary focus-visible:ring-2 focus-visible:ring-primary rounded"
                           aria-current="page"
                        >
                           Impostazioni
                        </Link>
                     </li>
                     <li>
                        <a
                           onClick={handleLogout}
                           className="hover:cursor-pointer hover:text-primary dark:hover:text-secondary focus:outline-primary dark:focus:outline-secondary focus-visible:ring-2 focus-visible:ring-primary rounded"
                        >
                           Esci
                        </a>
                     </li>
                  </ul>
               </div>

               <div className="flex items-center gap-4 lg:ml-4">
                  <button
                     type="button"
                     aria-controls="collapseMenu"
                     aria-expanded={isMenuOpen}
                     aria-haspopup="true"
                     id="toggleOpen"
                     onClick={openMenu}
                     className="cursor-pointer lg:hidden focus:outline-primary dark:focus:outline-secondary focus-visible:ring-2 focus-visible:ring-primary rounded">
                     <span className="sr-only">Open main menu</span>
                     <svg
                        className="size-7 fill-slate-900 dark:fill-slate-50"
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                     >
                        <path
                           fillRule="evenodd"
                           d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                           clipRule="evenodd"
                        ></path>
                     </svg>
                  </button>
               </div>
            </div>
         </nav>
         <div className="flex flex-col max-w-7xl mx-auto py-8 px-4 md:px-8">
            <h1 className=" text-2xl font-bold mb-2">Scegli la visita</h1>
            <div className="flex h-full gap-4 flex-col overflow-hidden rounded-lg border border-slate-300 dark:border-neutral-700">
               <nav className="flex flex-row justify-between shrink-0 border-b border-slate-300 px-4 py-3 dark:border-neutral-700">
                  <div className="flex items-center gap-2 w-full max-w-sm">
                     <div className="flex items-center gap-2 px-3 h-8 relative rounded-full bg-white dark:bg-neutral-800 
                  border border-slate-300 dark:border-neutral-700 
                  focus-within:border-primary dark:focus-within:border-secondary 
                  focus-within:ring-2 focus-within:ring-primary/20 dark:focus-within:ring-secondary/20"
                     >
                        <label htmlFor="search" className="sr-only">Cerca</label>
                        <input
                           type="search"
                           id="search"
                           placeholder="Cerca visita..."
                           value={search}
                           onChange={(e) => {
                              setSearch(e.target.value);
                              setActualPage(1);
                           }}
                           className="text-xs text-slate-900 dark:text-slate-50 w-full outline-none bg-transparent"
                        />
                     </div>

                  </div>
                  <div className="relative shrink-0">
                     <label htmlFor="sortOrder" className="sr-only">Ordina per</label>
                     <select
                        id="sortOrder"
                        value={sortOrder}
                        onChange={(e) => {
                           setSortOrder(e.target.value);
                           setActualPage(1);
                        }}
                        className="h-8 pl-3 pr-8 text-xs font-medium text-slate-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-full appearance-none cursor-pointer 
                     focus:outline-none 
                   focus:border-primary dark:focus:border-secondary 
                     focus:ring-2 focus:ring-primary/20 dark:focus:ring-secondary/20"
                     >
                        <option value="default">Ordina per...</option>
                        <option value="title-asc">Nome: A-Z</option>
                        <option value="title-desc">Nome: Z-A</option>
                        <option value="price-asc">Prezzo: crescente</option>
                        <option value="price-desc">Prezzo: decrescente</option>
                     </select>
                     <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-500 dark:text-neutral-400">
                        <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                     </div>
                  </div>
                  <div className="relative shrink-0">
                     <label htmlFor="pagerSize" className="sr-only">Page size:</label>
                     <select
                        id="pagerSize"
                        className="h-8 pl-3 pr-8 text-xs font-medium text-slate-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-full appearance-none cursor-pointer 
                     focus:outline-none focus:border-primary dark:focus:border-secondary focus:ring-2 focus:ring-primary/20 dark:focus:ring-secondary/20"
                        value={visitsOnScreen}
                        onChange={(e) => {
                           setVisitsOnScreen(Number(e.target.value));
                           setActualPage(1);
                        }}
                     >
                        <option value="3">3</option>
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                     </select>
                     <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-500 dark:text-neutral-400">
                        <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                     </div>
                  </div>
               </nav>

               {status === 'loading' && <p className="status-message">Caricamento visite…</p>}
               {status === 'error' && <p className="error-message">Non riesco a caricare le visite. Riprova più tardi.</p>}
               {status === 'ready' && visits.length === 0 && (
                  <p className="status-message">Nessuna visita disponibile per questo museo.</p>
               )}

               <ul className="flex flex-col flex-nowrap place-content-between min-h-0 flex-1 max-h-100 overflow-y-auto p-4 gap-3">
                  {visibleVisits.map(v => (
                     <li className="" key={v._id}>
                        <a onClick={() => navigate(`/visits/${v._id}`)} className="block p-4 border cursor-pointer border-slate-300 dark:border-neutral-700 rounded-lg hover:bg-primary/10 dark:hover:bg-secondary/10 focus:outline-primary dark:focus:outline-secondary focus-visible:ring-2 focus-visible:ring-primary hover:translate-y-1 duration-100">
                           <div className='flex justify-between'
                           >
                              <h5 className="text-2xl font-semibold tracking-tight text-heading leading-8">{v.title}</h5>
                              {v.price === 0 && <p className="text-sm text-slate-600">gratis</p>}
                              {v.price !== 0 && <p className="text-sm text-slate-600">{v.price} €</p>}

                           </div>
                           {visitedIds.has(v._id) && <h6 className="text-sm text-slate-600 dark:text-slate-400">Già visitata</h6>}
                           {v.description && <p className="text-body">{v.description}</p>}
                        </a>
                     </li>
                  ))}
               </ul>

               {/* Footer */}
               <div className="flex shrink-0 items-center justify-between border-t border-slate-300 px-4 py-3 dark:border-neutral-700">
                  {maxPages !== 1 &&
                     <nav aria-label="Pagination" className="flex space-x-4 justify-center mt-8">
                        <button
                           type="button"
                           onClick={goToPreviousPage}
                           disabled={actualPage === 1}
                           aria-label="Previous page"
                           className="flex items-center justify-center shrink-0 bg-gray-200 w-9 h-9 rounded-md disabled:opacity-50 enabled:hover:bg-primary/30 enabled:focus:outline-primary enabled:dark:focus:outline-secondary enabled:cursor-pointer enabled:focus-visible:ring-2 enabled:focus-visible:ring-primary/650 dark:bg-neutral-800 dark:text-slate-50 enabled:dark:hover:bg-secondary/30 duration-100 enabled:hover:translate-y-0.5"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg"
                              className="fill-slate-600 size-3 overflow-visible dark:fill-slate-50 rotate-180" viewBox="0 0 451.846 451.847"
                              aria-hidden="true">
                              <path
                                 d="M345.441 248.292 151.154 442.573c-12.359 12.365-32.397 12.365-44.75 0-12.354-12.354-12.354-32.391 0-44.744L278.318 225.92 106.409 54.017c-12.354-12.359-12.354-32.394 0-44.748 12.354-12.359 32.391-12.359 44.75 0l194.287 194.284c6.177 6.18 9.262 14.271 9.262 22.366 0 8.099-3.091 16.196-9.267 22.373"
                                 data-original="#000000" />
                           </svg>
                        </button>
                        {Array.from({ length: maxPages }, (_, index) => {
                           const page = index + 1;

                           return (
                              <button
                                 key={page}
                                 type="button"
                                 onClick={() => setActualPage(page)}
                                 aria-current={actualPage === page ? "page" : undefined}
                                 className={
                                    actualPage === page
                                       ? "flex items-center justify-center shrink-0 text-sm font-semibold text-white w-9 h-9 rounded-md bg-primary dark:bg-secondary focus:outline-primary dark:focus:outline-secondary focus-visible:ring-2 focus-visible:ring-primary/500"
                                       : "flex cursor-pointer items-center justify-center shrink-0 text-sm font-semibold text-slate-900 w-9 h-9 rounded-md hover:bg-primary/30 focus:outline-primary dark:focus:outline-secondary focus-visible:ring-2 focus-visible:ring-primary/650 dark:bg-neutral-800 dark:text-slate-50 dark:hover:bg-secondary/30 duration-100 enabled:hover:translate-y-0.5"
                                 }
                              >
                                 {page}
                              </button>
                           );
                        })}
                        <button
                           type="button"
                           onClick={goToNextPage}
                           disabled={actualPage === maxPages}
                           aria-label="Next page"
                           className="flex items-center justify-center shrink-0 bg-gray-200 w-9 h-9 rounded-md disabled:opacity-50 enabled:hover:bg-primary/30 enabled:focus:outline-primary enabled:dark:focus:outline-secondary enabled:cursor-pointer enabled:focus-visible:ring-2 enabled:focus-visible:ring-primary/650 dark:bg-neutral-800 dark:text-slate-50 enabled:dark:hover:bg-secondary/30 duration-100 enabled:hover:translate-y-0.5"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="fill-slate-600 size-3 overflow-visible dark:fill-slate-50"
                              viewBox="0 0 451.846 451.847" aria-hidden="true">
                              <path
                                 d="M345.441 248.292 151.154 442.573c-12.359 12.365-32.397 12.365-44.75 0-12.354-12.354-12.354-32.391 0-44.744L278.318 225.92 106.409 54.017c-12.354-12.359-12.354-32.394 0-44.748 12.354-12.359 32.391-12.359 44.75 0l194.287 194.284c6.177 6.18 9.262 14.271 9.262 22.366 0 8.099-3.091 16.196-9.267 22.373"
                                 data-original="#000000" />
                           </svg>
                        </button>
                     </nav>
                  }
                  <div className="text-sm text-slate-600 dark:text-slate-400 self-end">
                     <span className="font-medium mx-1">{firstVisible}</span>
                     -
                     <span className="font-medium mx-1">{lastVisible}</span>
                     di
                     <span className="font-medium mx-1">{filteredVisits.length}</span>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}