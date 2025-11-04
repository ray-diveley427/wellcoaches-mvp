// =====================================================================
// Multi-Perspective AI - UI Module
// =====================================================================
// UI-related functions: toasts, scrolling, auto-resize, dropdowns, modals

// =====================================================================
// TOAST NOTIFICATIONS
// =====================================================================

/**
 * Display a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'success', 'error', 'warning'
 */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 5rem; right: 2rem;
    padding: 1rem 1.5rem;
    background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#14b8a6'};
    color: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 2000; animation: slideInDown 0.3s ease-out;`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// =====================================================================
// SCROLL & RESIZE
// =====================================================================

/**
 * Scroll chat messages to bottom
 */
function scrollToBottom() {
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

/**
 * Auto-resize textarea based on content
 */
function autoResize() {
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  }
}

// =====================================================================
// DROPDOWN MANAGEMENT
// =====================================================================

/**
 * Toggle dropdown visibility
 * @param {HTMLElement} dropdown - Dropdown element
 */
function toggleDropdown(dropdown) {
  if (!dropdown) return;

  const isOpen = dropdown.classList.contains('active');

  // Close all dropdowns first
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));

  // Toggle this dropdown
  if (!isOpen) {
    dropdown.classList.add('active');
  }
}

/**
 * Close all dropdowns
 */
function closeAllDropdowns() {
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
}

/**
 * Setup dropdown event listeners
 */
function setupDropdowns() {
  // Toggle dropdowns on click
  document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = toggle.closest('.dropdown');
      toggleDropdown(dropdown);
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
      closeAllDropdowns();
    }
  });

  // Prevent dropdown from closing when clicking inside dropdown menu
  document.querySelectorAll('.dropdown-menu').forEach(menu => {
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });
}

// =====================================================================
// HISTORY SIDEBAR
// =====================================================================

/**
 * Open history sidebar
 */
function openHistory() {
  const sidebar = document.getElementById('historySidebar');
  const mainContent = document.getElementById('mainContent');

  if (sidebar && mainContent) {
    sidebar.classList.add('active');
    mainContent.classList.add('sidebar-open');
  }
}

/**
 * Close history sidebar
 */
function closeHistory() {
  const sidebar = document.getElementById('historySidebar');
  const mainContent = document.getElementById('mainContent');

  if (sidebar && mainContent) {
    sidebar.classList.remove('active');
    mainContent.classList.remove('sidebar-open');
  }
}

/**
 * Toggle history sidebar
 */
function toggleHistory() {
  const sidebar = document.getElementById('historySidebar');
  if (sidebar && sidebar.classList.contains('active')) {
    closeHistory();
  } else {
    openHistory();
  }
}

// =====================================================================
// CLEAR CHAT
// =====================================================================

/**
 * Clear all chat messages
 */
function clearChat() {
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');

  if (chatMessages) {
    chatMessages.innerHTML = `
      <div class="message assistant">
        <div style="font-size: 16px;">Welcome 👋</div>
        <div style="margin-top: 0.5rem;">Tap <strong>Methods</strong> to choose an analysis approach, or tell me what's on your mind.</div>
      </div>`;
  }

  if (chatInput) {
    chatInput.value = '';
    chatInput.placeholder = 'Describe your situation or ask a question...';
    autoResize();
  }
}

// =====================================================================
// EXPORTS
// =====================================================================
if (typeof window !== 'undefined') {
  window.showToast = showToast;
  window.scrollToBottom = scrollToBottom;
  window.autoResize = autoResize;
  window.toggleDropdown = toggleDropdown;
  window.closeAllDropdowns = closeAllDropdowns;
  window.setupDropdowns = setupDropdowns;
  window.openHistory = openHistory;
  window.closeHistory = closeHistory;
  window.toggleHistory = toggleHistory;
  window.clearChat = clearChat;
}
