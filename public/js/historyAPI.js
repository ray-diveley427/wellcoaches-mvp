// public/js/historyAPI.js
const API_BASE = "/api/history";

function getUserId() {
  // Prefer authenticated user from ID token
  const idToken = localStorage.getItem("id_token");
  if (idToken && idToken.split(".").length === 3) {
    try {
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      if (payload && payload.sub) {
        return payload.sub;
      }
    } catch (e) {
      console.warn("Unable to decode id_token for userId, falling back to local id.");
    }
  }
  // Fallback: stable local ID
  let id = localStorage.getItem("mpai_user_id");
  if (!id) {
    id = "user-" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("mpai_user_id", id);
    console.log(`🆕 Generated new user ID: ${id}`);
  }
  return id;
}

async function loadHistory() {
  const userId = getUserId();
  const res = await fetch(`${API_BASE}/${userId}`);
  return res.ok ? res.json() : [];
}

async function saveHistory(conversation) {
  const userId = getUserId();
  await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...conversation }),
  });
}

async function clearHistory() {
  const userId = getUserId();
  await fetch(`${API_BASE}/${userId}`, { method: "DELETE" });
}

window.historyAPI = { loadHistory, saveHistory, clearHistory };
