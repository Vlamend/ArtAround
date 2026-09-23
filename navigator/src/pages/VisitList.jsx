import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getVisits, logout, getMe } from '../api.js';

export default function VisitList({ museum, onLogout }) {
  const [visits, setVisits] = useState([]);
  const [visitedIds, setVisitedIds] = useState(new Set());
  const [status, setStatus] = useState('loading');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const lastFocusedElementRef = useRef(null);
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

  function handleLogout() {
    logout();
    onLogout();
  }

  const openMenu = () => {
      lastFocusedElementRef.current = document.activeElement;
      setIsMenuOpen(true);

      // Move focus into menu after state update
      setTimeout(() => {
         menuRef.current?.focus();
      }, 0);
   };

   const closeMenu = () => {
      setIsMenuOpen(false);

      // Restore focus after state update
      setTimeout(() => {
         lastFocusedElementRef.current?.focus();
      }, 0);
   };
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
                     className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
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
                        className="hover:text-primary dark:hover:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                        aria-current="page"
                     >
                        Impostazioni
                     </Link>
                  </li>
                  <li>
                     <a
                        onClick={handleLogout}
                        className="hover:cursor-pointer hover:text-primary dark:hover:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
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
                  className="cursor-pointer lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
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
      <div className="flex flex-col gap-4 max-w-7xl mx-auto py-8 px-4 md:px-8">
         <h1 className=" text-2xl font-bold">Scegli la visita</h1>

         {status === 'loading' && <p className="status-message">Caricamento visite…</p>}
         {status === 'error' && <p className="error-message">Non riesco a caricare le visite. Riprova più tardi.</p>}
         {status === 'ready' && visits.length === 0 && (
         <p className="status-message">Nessuna visita disponibile per questo museo.</p>
         )}

         <ul className="flex flex-col gap-4">
         {visits.map(v => (
            <li key={v._id}>
               
               <a onClick={() => navigate(`/visits/${v._id}`)} className="block p-4 border cursor-pointer border-slate-300 dark:border-neutral-700 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <h5 className="mb-3 text-2xl font-semibold tracking-tight text-heading leading-8">{v.title}</h5>
                  {visitedIds.has(v._id) && <h6 >Già visitata</h6>}
                  {v.description && <p className="text-body">{v.description}</p>}
               </a>
            </li>
         ))}
         </ul>
      </div>
    </div>
  );
}
