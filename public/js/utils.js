// =====================================================================
// Multi-Perspective AI - Utilities
// =====================================================================
// Shared utility functions for error handling, UI helpers, and common operations

// =====================================================================
// ERROR HANDLING
// =====================================================================

/**
 * Centralized error handler for consistent error management
 * @param {Error|string} error - The error object or message
 * @param {string} userMessage - User-friendly error message to display
 * @param {boolean} shouldToast - Whether to show toast notification (default: true)
 * @param {string} context - Optional context for logging (e.g., function name)
 */
function handleError(error, userMessage, shouldToast = true, context = '') {
  const errorMessage = error instanceof Error ? error.message : error;
  const logPrefix = context ? `❌ [${context}]` : '❌';

  console.error(logPrefix, errorMessage, error);

  if (shouldToast && typeof showToast === 'function') {
    showToast(userMessage, 'error');
  }
}

/**
 * Async wrapper with error handling
 * @param {Function} fn - Async function to execute
 * @param {string} errorMessage - Error message to show on failure
 * @param {string} context - Context for logging
 * @returns {Promise<any>} - Result of function or null on error
 */
async function tryCatch(fn, errorMessage, context = '') {
  try {
    return await fn();
  } catch (error) {
    handleError(error, errorMessage, true, context);
    return null;
  }
}

// =====================================================================
// UI UTILITIES
// =====================================================================

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} - Escaped HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format timestamp to human-readable "time ago" format
 * @param {string|number|Date} timestamp - Timestamp to format
 * @returns {string} - Formatted string like "5 minutes ago"
 */
function formatTimeAgo(timestamp) {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Debounce function to limit execution rate
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Query selector with optional parent and error handling
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Optional parent element
 * @returns {HTMLElement|null} - Found element or null
 */
function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Query selector all with optional parent
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Optional parent element
 * @returns {NodeList} - Found elements
 */
function qsa(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

// =====================================================================
// VALIDATION
// =====================================================================

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 * @param {any} value - Value to check
 * @returns {boolean} - True if empty
 */
function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Validate session ID format
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean} - True if valid
 */
function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && sessionId.length > 0;
}

// =====================================================================
// EXPORTS (for ES6 modules or global access)
// =====================================================================
// Make utilities available globally for vanilla JS usage
if (typeof window !== 'undefined') {
  window.handleError = handleError;
  window.tryCatch = tryCatch;
  window.escapeHtml = escapeHtml;
  window.formatTimeAgo = formatTimeAgo;
  window.debounce = debounce;
  window.qs = qs;
  window.qsa = qsa;
  window.isEmpty = isEmpty;
  window.isValidSessionId = isValidSessionId;
}
