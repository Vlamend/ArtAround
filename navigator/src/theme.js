const STORAGE_KEY = 'theme-mode';

export function applyMuseumTheme(museum) {
  const root = document.documentElement;
  if (museum?.primaryColor) {
    root.style.setProperty('--color-primary', museum.primaryColor);
  }
  if (museum?.secondaryColor) {
    root.style.setProperty('--color-secondary', museum.secondaryColor);
  }
}

export function clearMuseumTheme() {
  const root = document.documentElement;
  root.style.removeProperty('--color-primary');
  root.style.removeProperty('--color-secondary');
}

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

export function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  sessionStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
  return isDark;
}