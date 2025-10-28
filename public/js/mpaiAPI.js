// public/js/mpaiAPI.js
// =======================================================
// Basic API wrapper for MPAI backend
// =======================================================

const mpaiAPI = {
    /**
     * Call the main analyze endpoint
     */
    async analyze(userQuery, method = null, perspectiveVisibility = 'visible', sessionId = null) {
      try {
        const payload = { userQuery, perspectiveVisibility };
        if (method) payload.method = method;
        if (sessionId) payload.sessionId = sessionId;
  
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
  
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Analysis failed');
        }
  
        return await response.json();
      } catch (err) {
        console.error('❌ API error:', err);
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
  