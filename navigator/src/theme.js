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