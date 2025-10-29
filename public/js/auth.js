// --- Detect environment ---
const isLocal =
  window.location.hostname.includes("localhost") ||
  window.location.hostname.includes("127.0.0.1");

const redirectUri = "http://localhost:3000/callback.html";
const logoutUri = "http://localhost:3000/"; // ✅ Added trailing slash to match AWS config

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
  
  // Clear all tokens
  localStorage.removeItem("id_token");
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  sessionStorage.clear();
  
  console.log("✅ Tokens cleared from localStorage");
  
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