// ==================================================================
// Session Timeout Handler - HIPAA Compliance
// ==================================================================
// Automatically logs users out after 15 minutes of inactivity
// Required for HIPAA compliance to prevent unauthorized access

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before timeout

let timeoutId = null;
let warningId = null;
let lastActivityTime = Date.now();

/**
 * Reset the inactivity timer
 */
function resetSessionTimer() {
  lastActivityTime = Date.now();

  // Clear existing timers
  if (timeoutId) clearTimeout(timeoutId);
  if (warningId) clearTimeout(warningId);

  // Set warning timer (13 minutes)
  warningId = setTimeout(showTimeoutWarning, SESSION_TIMEOUT - WARNING_TIME);

  // Set logout timer (15 minutes)
  timeoutId = setTimeout(handleSessionTimeout, SESSION_TIMEOUT);
}

/**
 * Show warning that session is about to expire
 */
function showTimeoutWarning() {
  const modal = document.createElement('div');
  modal.id = 'sessionTimeoutWarning';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 16px;
      padding: 2rem;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    ">
      <div style="font-size: 3rem; margin-bottom: 1rem;">⏰</div>
      <h2 style="margin: 0 0 1rem 0; color: #1f2937;">Session Expiring Soon</h2>
      <p style="color: #6b7280; margin-bottom: 2rem;">
        Your session will expire in 2 minutes due to inactivity.
        Click "Stay Logged In" to continue.
      </p>
      <div style="display: flex; gap: 1rem; justify-content: center;">
        <button id="stayLoggedInBtn" style="
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        ">Stay Logged In</button>
        <button id="logoutNowBtn" style="
          padding: 0.75rem 1.5rem;
          background: #f3f4f6;
          color: #374151;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        ">Log Out Now</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Handle button clicks
  document.getElementById('stayLoggedInBtn').addEventListener('click', () => {
    modal.remove();
    resetSessionTimer();
    if (typeof showToast === 'function') {
      showToast('Session extended', 'success');
    }
  });

  document.getElementById('logoutNowBtn').addEventListener('click', () => {
    modal.remove();
    handleSessionTimeout();
  });
}

/**
 * Handle session timeout - log user out
 */
async function handleSessionTimeout() {
  // Clear any existing timers
  if (timeoutId) clearTimeout(timeoutId);
  if (warningId) clearTimeout(warningId);

  // Remove warning modal if it exists
  const warningModal = document.getElementById('sessionTimeoutWarning');
  if (warningModal) warningModal.remove();

  // Show timeout message
  if (typeof showToast === 'function') {
    showToast('Session expired due to inactivity', 'warning');
  }

  // Log out the user
  if (typeof signOut === 'function') {
    await signOut();
  } else {
    // Fallback: clear tokens and reload
    localStorage.removeItem('id_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.reload();
  }
}

/**
 * Initialize session timeout tracking
 */
function initSessionTimeout() {
  // Only track if user is logged in
  const idToken = localStorage.getItem('id_token');
  if (!idToken) return;

  // Start the timer
  resetSessionTimer();

  // Track user activity
  const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

  activityEvents.forEach(event => {
    document.addEventListener(event, resetSessionTimer, { passive: true });
  });

  console.log('✅ Session timeout initialized (15 min inactivity)');
}

// Export functions
if (typeof window !== 'undefined') {
  window.initSessionTimeout = initSessionTimeout;
  window.resetSessionTimer = resetSessionTimer;
}

export { initSessionTimeout, resetSessionTimer, handleSessionTimeout };
