import { useState } from 'react';
import { login } from '../api.js';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onLogin();
    } catch (err) {
      setError(err.message || 'Credenziali non valide.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-gray-50 px-4 md:px-8 dark:bg-neutral-900">
         <div className="min-h-screen flex flex-col items-center justify-center">
            <div className="max-w-md w-full">
               <div
                  className="p-6 rounded-lg bg-white border border-slate-300 shadow-xs md:p-8 dark:bg-neutral-800 dark:border-neutral-700">
                  <h1 className="text-slate-900 text-center text-3xl font-bold dark:text-slate-50">Accedi</h1>

                  <form className="space-y-6 mt-10" onSubmit={handleSubmit}>
                     <div>
                        <label htmlFor="email"
                           className="mb-2 text-slate-900 font-medium text-sm inline-block dark:text-slate-50">Email</label>
                        <input 
                          type="email" 
                          id="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          autoComplete="email"
                          className="px-3 py-2.5 text-sm text-slate-900 rounded-md bg-white w-full outline-1 -outline-offset-1 outline-slate-300 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:text-slate-50 dark:bg-neutral-700 dark:outline-neutral-600" />
                     </div>
                     <div>
                        <label htmlFor="password"
                           className="mb-2 text-slate-900 font-medium text-sm inline-block dark:text-slate-50">Password</label>
                        <input 
                          type="password" 
                          id="password" 
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          autoComplete="current-password"
                          className="px-3 py-2.5 text-sm text-slate-900 rounded-md bg-white w-full outline-1 -outline-offset-1 outline-slate-300 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:text-slate-50 dark:bg-neutral-700 dark:outline-neutral-600" />
                     </div>
                     
                     {error && 
                     <div className="flex items-center justify-center flex-wrap gap-2 bg-rose-500/10 border-rose-500 border-1 text-rose-700 text-sm rounded-md p-2">
                      <p className="error-message">{error}</p>
                     </div>}
                     <button type="submit"
                        className="w-full py-2 px-3.5 text-sm rounded-md font-semibold cursor-pointer tracking-wide text-white border border-indigo-600 bg-indigo-600 hover:bg-indigo-700 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                        Accedi</button>

                     <div className="text-slate-900 text-sm text-center dark:text-slate-50">Non hai un account? <a href="#"
                        className="text-indigo-700 hover:underline ml-1 font-medium dark:text-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">Sign
                        up</a>
                     </div>
                  </form>
               </div>
            </div>
         </div>
      </main>
  );
}
