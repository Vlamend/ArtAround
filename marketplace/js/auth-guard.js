import { clearToken, getToken, getMe, logout } from './api.js';

/*
 * Da chiamare all'inizio di ogni pagina protetta.
 * 1. Se nel localStorage non c'è il token reindirizza al login e ritorna null.
 * 2. Altrimenti chiede al server chi è l'utente: controlla che il token sia valido,
 * non solo che esista.
 * 3. Se è valido disegna l'header e ritorna l'utente. Se il server lo rifiuta
 * elimina il token, reindirizza al login e ritorna null.
 */
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

// Aggiunge all'header lo username col ruolo, i link riservati agli admin e il pulsante di logout
function renderHeader(user) {
  const header = document.querySelector('header');
  if (!header) return;

  // Si usano createElement e textContent, non innerHTML, perché lo username lo sceglie l'utente
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
