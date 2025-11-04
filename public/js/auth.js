// --- Detect environment and set base URL ---
function getBaseUrl() {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;

  // Build URL using current protocol (HTTP or HTTPS) to avoid mixed content errors
  if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
    // Local development
    return "http://localhost:3000";
  } else {
    // Use whatever protocol the page was loaded with (HTTP or HTTPS)
    // This prevents mixed content errors when testing without SSL
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  }
}

const baseUrl = getBaseUrl();
const redirectUri = `${baseUrl}/callback.html`;
const logoutUri = `${baseUrl}/`;

// --- Cognito configuration ---
const cognitoDomain = "https://us-east-1eucicqax3.auth.us-east-1.amazoncognito.com";
const clientId = "7m3hp4bdldr9642grf15rhhp24";

console.log("Redirect URI:", redirectUri);
console.log("Logout URI:", logoutUri);

// --- LOGIN ---
export async function signIn() {
  console.log("🔹 Starting Cognito sign-in...");
  
  const authUrl = new URL(`${cognitoDomain}/oauth2/authorize`);
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', 'openid email phone');
  authUrl.searchParams.append('redirect_uri', redirectUri);
  
  console.log("🔹 Auth URL:", authUrl.toString());
  window.location.href = authUrl.toString();
}

// --- LOGOUT ---

export async function signOut() {
  console.log("🔹 Signing out...");
  
  // ✅ Clear all tokens
  localStorage.removeItem("id_token");
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  
  // Set a flag that logout was initiated (before clearing sessionStorage)
  // Also clear login prompt dismissal so it shows again after logout
  localStorage.removeItem('loginPromptDismissed');
  
  // Clear sessionStorage but preserve logout flag
  sessionStorage.clear();
  sessionStorage.setItem('logout_success', 'true');
  
  console.log("✅ Tokens cleared from localStorage");
  
  // ✅ NEW: Clear conversation history from memory
  if (window.conversationHistory) {
    window.conversationHistory = [];
  }
  
  // ✅ NEW: Clear the UI
  const historyContent = document.getElementById('historyContent');
  if (historyContent) {
    historyContent.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-title">No conversations yet</div>
        <div class="history-empty-text">Please log in to view your history</div>
      </div>
    `;
  }
  
  // Build logout URL - MUST be /logout not /login
  const logoutUrl = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  
  console.log("🔹 Logout URL:", logoutUrl);
  
  // Redirect to Cognito logout
  window.location.href = logoutUrl;
}

// --- GET USER ---
export async function getUser() {
  const idToken = localStorage.getItem("id_token");
  if (!idToken) return null;
  
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    return {
      profile: {
        email: payload.email,
        sub: payload.sub,
      },
    };
  } catch (err) {
    console.error("Error decoding token:", err);
    return null;
  }
}

// --- IS AUTHENTICATED ---
export async function isAuthenticated() {
  return !!localStorage.getItem("id_token");
}