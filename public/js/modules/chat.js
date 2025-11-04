// =====================================================================
// Multi-Perspective AI - Chat Module
// =====================================================================
// Chat message handling, sending messages, and chat UI management

// State
let isLoading = false;
let currentSessionId = null;

// =====================================================================
// MESSAGE RENDERING
// =====================================================================

/**
 * Add a message to the chat
 * @param {string} type - Message type: 'user' or 'assistant'
 * @param {string} content - Message content
 */
function addMessage(type, content) {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  const div = document.createElement('div');
  div.className = `message ${type}`;

  if (type === 'user') {
    div.innerHTML = window.escapeHtml(content);
  } else {
    div.innerHTML = window.convertMarkdownToHTML(content);
  }

  chatMessages.appendChild(div);
  window.scrollToBottom();
}

/**
 * Add a loading message to the chat
 * @returns {string} - ID of the loading message element
 */
function addLoadingMessage() {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return null;

  const id = `loading-${Date.now()}`;
  const div = document.createElement('div');
  div.id = id;
  div.className = 'message assistant';
  div.innerHTML = `<div class="loading"><span>Analyzing</span>
      <div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>`;

  chatMessages.appendChild(div);
  window.scrollToBottom();
  return id;
}

/**
 * Remove a loading message
 * @param {string} id - ID of the loading message to remove
 */
function removeLoadingMessage(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

// =====================================================================
// SEND MESSAGE
// =====================================================================

/**
 * Send a message to the AI
 */
async function sendMessage() {
  if (isLoading) return;

  const chatInput = document.getElementById('chatInput');
  const sendButton = document.getElementById('sendButton');
  if (!chatInput || !sendButton) return;

  const query = chatInput.value.trim();
  if (!query) return;

  // Check if user is logged in
  const userId = window.getCurrentUserId();
  if (!userId) {
    window.showToast('Please log in to use the chat', 'error');
    return;
  }

  // Add user message
  addMessage('user', query);
  chatInput.value = '';
  window.autoResize();
  sendButton.disabled = true;
  isLoading = true;

  const loadingId = addLoadingMessage();

  try {
    // Get selected method and perspective visibility
    const selectedMethod = window.getSelectedMethod();
    const perspectiveVisibility = window.getPerspectiveVisibility();

    // Send to API
    const result = await window.mpaiAPI.analyze(
      query,
      selectedMethod,
      perspectiveVisibility,
      currentSessionId
    );

    removeLoadingMessage(loadingId);

    if (result.success) {
      addMessage('assistant', result.response);

      // Update session ID
      if (!currentSessionId) {
        currentSessionId = result.sessionId;
        console.log(`✨ New session: ${currentSessionId}`);
      } else {
        console.log(`🔄 Continuing session: ${currentSessionId}`);
      }

      // Show method used
      if (result.method) {
        const methods = window.METHODS;
        const method = methods.find(m => m.key === result.method);
        if (method) {
          window.showToast(`Used method: ${method.name}`, 'info');
        }
      }

      // Context info logging
      if (result.contextInfo) {
        const { messageCount } = result.contextInfo;
        if (messageCount > 0) {
          console.log(`📚 Using ${messageCount} prior messages for context`);
        }
      }

      // Reload history to show new exchange
      if (window.loadHistory) {
        await window.loadHistory();
      }
    } else {
      addMessage('assistant', `Error: ${result.error || 'Failed to get response'}`);
      window.showToast('Failed to analyze', 'error');
    }
  } catch (error) {
    console.error('❌ Error sending message:', error);
    removeLoadingMessage(loadingId);
    addMessage('assistant', 'Sorry, there was an error processing your request.');
    window.showToast('Network error occurred', 'error');
  } finally {
    isLoading = false;
    sendButton.disabled = false;
    chatInput.focus();
  }
}

// =====================================================================
// SESSION MANAGEMENT
// =====================================================================

/**
 * Get current session ID
 * @returns {string|null} - Current session ID or null
 */
function getCurrentSessionId() {
  return currentSessionId;
}

/**
 * Set current session ID
 * @param {string|null} sessionId - Session ID to set
 */
function setCurrentSessionId(sessionId) {
  currentSessionId = sessionId;
}

/**
 * Start a new session
 */
function startNewSession() {
  currentSessionId = null;
  window.clearChat();
  window.clearSelectedMethod();

  // Clear active state from all history cards
  document.querySelectorAll('.history-item').forEach(card => {
    card.classList.remove('active');
  });

  window.showToast('🆕 Started a new conversation');
}

// =====================================================================
// EXPORTS
// =====================================================================
if (typeof window !== 'undefined') {
  window.addMessage = addMessage;
  window.addLoadingMessage = addLoadingMessage;
  window.removeLoadingMessage = removeLoadingMessage;
  window.sendMessage = sendMessage;
  window.getCurrentSessionId = getCurrentSessionId;
  window.setCurrentSessionId = setCurrentSessionId;
  window.startNewSession = startNewSession;
}
