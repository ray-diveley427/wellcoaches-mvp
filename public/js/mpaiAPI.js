// public/js/mpaiAPI.js
// =======================================================
// Basic API wrapper for MPAI backend
// =======================================================

function getEffectiveUserId() {
  const idToken = localStorage.getItem('id_token');
  if (idToken && idToken.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      if (payload && payload.sub) return payload.sub;
    } catch (_) {}
  }
  return localStorage.getItem('mpai_user_id') || 'user-1';
}

const mpaiAPI = {
    /**
     * Call the main analyze endpoint
     */
    async analyze(userQuery, method = null, perspectiveVisibility = 'visible', sessionId = null) {
      try {
        const userId = getEffectiveUserId();
        const payload = { userQuery, perspectiveVisibility, userId };
        if (method) payload.method = method;
        if (sessionId) {
          payload.sessionId = sessionId;
          console.log(`📤 Sending with sessionId: ${sessionId.substring(0, 8)}...`);
        } else {
          console.log(`📤 Creating new session (no sessionId provided)`);
        }
  
        const headers = { 'Content-Type': 'application/json' };
        const idToken = localStorage.getItem('id_token');
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }
        
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
  
        if (!response.ok) {
          const error = await response.json();
          
          // For 429 (rate limit) responses, preserve all error details including cost limit info
          if (response.status === 429 && error.costLimitExceeded) {
            return {
              success: false,
              error: error.error || 'Cost limit exceeded',
              costLimitExceeded: true,
              monthlyLimitExceeded: error.monthlyLimitExceeded || false,
              monthlyCost: error.monthlyCost,
              monthlyLimit: error.monthlyLimit,
              monthlyRemaining: error.monthlyRemaining
            };
          }
          
          // For other errors, create an Error but preserve the full error object
          const errorObj = new Error(error.error || 'Analysis failed');
          errorObj.status = response.status;
          errorObj.originalError = error;
          throw errorObj;
        }

        return await response.json();
      } catch (err) {
        console.error('❌ API error:', err);
        // If it's already a structured error (from 429), return it as-is
        if (err.costLimitExceeded !== undefined) {
          return err;
        }
        return { success: false, error: err.message };
      }
    },
  
    /**
     * Quick health check
     */
    async health() {
      try {
        const response = await fetch('/api/health');
        return await response.json();
      } catch (err) {
        console.error('❌ Health check failed:', err);
        return { status: 'error' };
      }
    },
  };
  
  // Expose globally for app.js
  window.mpaiAPI = mpaiAPI;
  