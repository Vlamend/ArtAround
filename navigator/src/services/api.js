const API_URL = "http://localhost:3000/api";

export async function getVisits() {
  return fetch(`${API_URL}/visits`).then(r => r.json());
}
