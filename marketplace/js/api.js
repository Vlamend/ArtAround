const API = "http://localhost:3000/api";

export async function getItems() {
  return fetch(`${API}/items`).then(r => r.json());
}
