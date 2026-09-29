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

  // Costruito con il DOM e textContent, non con innerHTML: lo username
  // lo sceglie l'utente in fase di registrazione.
  const userInfo = document.createElement('div');

  const label = document.createElement('span');
  label.style.marginRight = '1rem';
  label.textContent = `${user.username} (${user.role})`;
  userInfo.appendChild(label);

  if (user.role === 'admin') {
    for (const [href, text] of [['users-admin', 'Gestione autori'], ['config-editor', 'Config Navigator']]) {
      const a = document.createElement('a');
      a.href = href;
      a.style.marginRight = '1rem';
      a.textContent = text;
      userInfo.appendChild(a);
    }
  }

  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logout-btn';
  logoutBtn.textContent = 'Esci';
  userInfo.appendChild(logoutBtn);
  header.appendChild(userInfo);

  logoutBtn.addEventListener('click', () => {
    logout();
    window.location.href = 'login';
  });
}
