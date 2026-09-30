// Chiave del sessionStorage in cui si ricorda la modalità scelta ('dark' o 'light')
const STORAGE_KEY = 'theme-mode';

// Applica i colori del museo alle variabili CSS --color-primary e --color-secondary.
// Se il museo non li definisce restano quelli di default del CSS.
export function applyMuseumTheme(museum) {
  const root = document.documentElement;
  if (museum?.primaryColor) {
    root.style.setProperty('--color-primary', museum.primaryColor);
  }
  if (museum?.secondaryColor) {
    root.style.setProperty('--color-secondary', museum.secondaryColor);
  }
}

/*
 * Imposta la modalità chiara/scura all'avvio dell'app e restituisce true se è scura.
 * 1. Se nel sessionStorage c'è già una scelta la applica.
 * 2. Altrimenti segue la preferenza del sistema operativo e la salva.
 */
export function initDarkMode() {
  const storedTheme = sessionStorage.getItem(STORAGE_KEY);

  if (storedTheme === 'dark' || storedTheme === 'light') {
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');
    return storedTheme === 'dark';
  }

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  document.documentElement.classList.toggle('dark', isDark);
  sessionStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');

  return isDark;
}

// Inverte la modalità, la salva nel sessionStorage e restituisce true se ora è scura
export function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  sessionStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
  return isDark;
}