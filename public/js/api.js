// public/js/api.js
/**
 * Client-side API wrapper for MPAI backend
 * Usage: const result = await mpaiAPI.analyze(userQuery, method);
 */

const mpaiAPI = {
  /**
   * Call the main analyze endpoint
   */
  async analyze(userQuery, method = null, perspectiveVisibility = 'visible', sessionId = null) {
    try {
      const payload = {
        userQuery,
        perspectiveVisibility,
      };

      if (method) payload.method = method;
      if (sessionId) payload.sessionId = sessionId;

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
   * Get session analyses
   */
  async getSession(sessionId) {
    try {
      const response = await fetch(`/api/session/${sessionId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }

      return await response.json();
    } catch (err) {
      console.error('❌ API error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Get all user sessions
   */
  async getSessions() {
    try {
      const response = await fetch('/api/sessions');

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      return await response.json();
    } catch (err) {
      console.error('❌ API error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Create new session
   */
  async createSession() {
    try {
      const response = await fetch('/api/session/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      return await response.json();
    } catch (err) {
      console.error('❌ API error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Save user preference
   */
  async savePreference(sessionId, preference, value) {
    try {
      const response = await fetch('/api/preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          preference,
          value,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preference');
      }

      return await response.json();
    } catch (err) {
      console.error('❌ API error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Get suggested method and bandwidth
   */
  async suggestMethod(userQuery) {
    try {
      const response = await fetch('/api/method/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userQuery }),
      });

      if (!response.ok) {
        throw new Error('Failed to get suggestion');
      }

      return await response.json();
    } catch (err) {
      console.error('❌ API error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Health check
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

// Export for use in HTML
if (typeof window !== 'undefined') {
  window.mpaiAPI = mpaiAPI;
}
