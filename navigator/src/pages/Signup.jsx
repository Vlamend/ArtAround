import { useState } from 'react';
import { signup } from '../api.js';

/*
 * Pagina di registrazione (l'account creato è sempre di tipo visitatore).
 * Alla conferma:
 * 1. Controlla che password e conferma password coincidano, altrimenti mostra l'errore.
 * 2. Chiama signup(), che salva anche il token, e avvisa App tramite onSignup.
 * 3. Se il server rifiuta la registrazione mostra il suo messaggio di errore.
 */
export default function Signup({ onSignup }) {
   const [username, setUsername] = useState('');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   // Campo "Conferma password"
   const [parsePassword, setParsingPassword] = useState('');
   const [error, setError] = useState('');

   async function handleSubmit(e) {
      e.preventDefault();
      setError('');
      if (password === parsePassword) {
         try {
            await signup(username, email, password);
            onSignup();
         } catch (err) {
            setError(err.message || 'Credenziali non valide.');
         }
      } else {
         setError('Le password non coincidono.');
         return;
      }
   }

   return (
      <main className="px-4 md:px-8 min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-neutral-900">
         <div className="max-w-md w-full">
            <div
               className="p-6 rounded-lg bg-white border border-slate-300 shadow-xs md:p-6 dark:bg-neutral-800 dark:border-neutral-700">
               <h1 className="text-slate-900 text-center text-2xl font-bold dark:text-slate-50">Create an account</h1>

               <form className="space-y-6 mt-10" onSubmit={handleSubmit}>
                  <div>
                     <label htmlFor="username"
                        className="mb-2 text-slate-900 font-medium text-sm inline-block dark:text-slate-50">Username</label>
                     <input type="text" id="username" name="username" placeholder='BigBoss' value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete='username'
                        className="px-3 py-2.5 text-sm text-slate-900 rounded-md bg-white w-full outline-1 -outline-offset-1 outline-slate-300 focus:outline-2 focus:-outline-offset-2 focus:outline-primary dark:focus:outline-secondary dark:text-slate-50 dark:bg-neutral-700 dark:outline-neutral-600" />
                  </div>
                  <div>
                     <label htmlFor="email"
                        className="mb-2 text-slate-900 font-medium text-sm inline-block dark:text-slate-50">Email</label>
                     <input type="email" id="email" name="email" placeholder="john@artaround.test" value={email} onChange={(e) => setEmail(e.target.value)} required
                        className="px-3 py-2.5 text-sm text-slate-900 rounded-md bg-white w-full outline-1 -outline-offset-1 outline-slate-300 focus:outline-2 focus:-outline-offset-2 focus:outline-primary dark:focus:outline-secondary dark:text-slate-50 dark:bg-neutral-700 dark:outline-neutral-600" />
                  </div>
                  <div>
                     <label htmlFor="password"
                        className="mb-2 text-slate-900 font-medium text-sm inline-block dark:text-slate-50">Password</label>
                     <input type="password" id="password" name="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete='new-password'
                        className="px-3 py-2.5 text-sm text-slate-900 rounded-md bg-white w-full outline-1 -outline-offset-1 outline-slate-300 focus:outline-2 focus:-outline-offset-2 focus:outline-primary dark:focus:outline-secondary dark:text-slate-50 dark:bg-neutral-700 dark:outline-neutral-600" />
                  </div>
                  <div>
                     <label htmlFor="confirm-password"
                        className="mb-2 text-slate-900 font-medium text-sm inline-block dark:text-slate-50">Conferma
                        password</label>
                     <input type="password" id="confirm-password" name="confirm-password" placeholder="••••••••" required value={parsePassword} onChange={(e) => setParsingPassword(e.target.value)} autoComplete='new-password'
                        className="px-3 py-2.5 text-sm text-slate-900 rounded-md bg-white w-full outline-1 -outline-offset-1 outline-slate-300 focus:outline-2 focus:-outline-offset-2 focus:outline-primary dark:focus:outline-secondary dark:text-slate-50 dark:bg-neutral-700 dark:outline-neutral-600" />
                  </div>

                  <div className="flex items-start flex-wrap gap-2">
                     <label className="flex items-center group has-[input:checked]:text-slate-900">
                        <input id="tmc" name="tmc" type="checkbox" required className="sr-only" />
                        {/* Checkbox personalizzata: l'input vero è nascosto (sr-only), questo span ne disegna il riquadro */}
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded outline-1 outline-slate-300 dark:outline-neutral-600
                              bg-white dark:bg-neutral-700
                              group-has-[input:checked]:bg-primary dark:group-has-[input:checked]:bg-secondary
                              group-has-[input:checked]:outline-primary dark:group-has-[input:checked]:outline-secondary
                              group-focus-within:outline-2
                              group-focus-within:outline-primary dark:group-focus-within:outline-secondary" aria-hidden="true">
                           {/* Segno di spunta, visibile solo quando l'input è selezionato */}
                           <svg className="size-3 text-white opacity-0 group-has-[input:checked]:opacity-100" viewBox="0 0 12 10"
                              fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 5l3 3 7-7" />
                           </svg>
                        </span>
                        <span className="ml-3 text-sm text-slate-700 dark:text-slate-300">
                           I accept the
                        </span>
                     </label>

                     <a href="#"
                        className="ml-1 text-sm font-medium text-primary dark:text-secondary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-secondary rounded">
                        Terms and Conditions
                     </a>
                  </div>
                  {error &&
                     <div className="flex items-center justify-center flex-wrap gap-2 bg-rose-500/10 border-rose-500 border text-rose-700 text-sm rounded-md p-2">
                        <p className="error-message">{error}</p>
                     </div>}
                  <button type="submit"
                     className="w-full py-2 px-3.5 text-sm rounded-md font-semibold cursor-pointer tracking-wide text-white border border-primary dark:border-secondary bg-primary dark:bg-secondary hover:bg-primary/40 dark:hover:bg-secondary/40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                     Create an account</button>
               </form>

               <div className="mt-6 text-slate-900 text-sm text-center dark:text-slate-50">Hai già un account?
                  <a href="/login"
                     className="text-primary hover:underline ml-1 font-medium dark:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:focus-visible:ring-secondary/40 rounded">
                     Vai al login</a>
               </div>
            </div>
         </div>
      </main>
   );
}
