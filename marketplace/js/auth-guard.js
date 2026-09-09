import { clearToken, getToken, getMe, logout } from './api.js';

// Da chiamare in cima ad ogni pagina protetta. Valida il token contro
// il server (non solo la sua presenza), stesso principio già adottato
// nel Navigator. Restituisce l'utente autenticato se tutto ok.
export async function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = 'login';
    return null;
  }

  try {
    const { user } = await getMe();
    renderHeader(user);
    return user;
  } catch {
    clearToken();
    window.location.href = 'login';
    return null;
  }
}

function renderHeader(user) {
  const header = document.querySelector('header');
  if (!header) return;

  const userInfo = document.createElement('div');
  userInfo.innerHTML = `
    <span style="margin-right: 1rem;">${user.username} (${user.role})</span>
    ${user.role === 'admin' ? '<a href="config-editor" style="margin-right: 1rem;">Config Navigator</a>' : ''}
    <button id="logout-btn">Esci</button>
  `;
  header.appendChild(userInfo);

  document.getElementById('logout-btn').addEventListener('click', () => {
    logout();
    window.location.href = 'login';
  });
}
