// =====================================================================
// Multi-Perspective AI - Main Application
// =====================================================================
// Note: This version expects auth.js, config.js, utils.js, and modules to be loaded first
// Dependencies:
//   - config.js: METHODS, FAQ_MAPPINGS, PRO_TOOLS
//   - utils.js: escapeHtml, formatTimeAgo, handleError, etc.
//   - modules/ui.js: showToast, scrollToBottom, autoResize, clearChat, etc.
//   - modules/methods.js: renderMethodsDropdown, selectMethod, etc.
//   - modules/chat.js: addMessage, sendMessage, etc. (supplementary)

// Use config constants (loaded from config.js)
const methods = window.METHODS;

// =====================================================================
// STATE MANAGEMENT
// =====================================================================
let currentSessionId = null;
let perspectiveVisibility = 'visible';
let selectedMethod = null;
let isLoading = false;
let fullHistoryCache = [];
let activeFilter = 'all';

// =====================================================================
// DOM ELEMENTS
// =====================================================================
const elements = {
  chatInput: document.getElementById('chatInput'),
  sendButton: document.getElementById('sendButton'),
  chatMessages: document.getElementById('chatMessages'),
  methodsList: document.getElementById('methodsList'),
  historySidebar: document.getElementById('historySidebar'),
  mainContent: document.getElementById('mainContent'),
  historyContent: document.getElementById('historyContent'),
};

// =====================================================================
// HELPER: Get Current User ID from Token
// =====================================================================
function getCurrentUserId() {
  const idToken = localStorage.getItem("id_token");
  if (!idToken) {
    // No token - will use fallback user ID
    return null;
  }
  
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    const userId = payload.sub;
    // User authenticated
    return userId; // Cognito user ID
  } catch (error) {
    console.error("❌ Failed to decode token:", error);
    return null;
  }
}

// =====================================================================
// MARKDOWN TO HTML CONVERTER
// =====================================================================
// Using marked library for proper markdown parsing
// CDN loaded in index.html: https://cdn.jsdelivr.net/npm/marked/marked.min.js
function convertMarkdownToHTML(markdown) {
  if (typeof marked !== 'undefined') {
    // Configure marked for better formatting
    marked.setOptions({
      breaks: true,        // Convert \n to <br>
      gfm: true,          // GitHub Flavored Markdown
      headerIds: false,    // Don't add IDs to headers
      mangle: false       // Don't escape autolinked email addresses
    });
    return marked.parse(markdown);
  }

  // Fallback to basic regex if marked isn't loaded
  let html = markdown;
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  html = html.replace(/^\- (.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  return '<p>' + html + '</p>';
}

// =====================================================================
// UTILITIES
// =====================================================================
// Note: escapeHtml, formatTimeAgo, handleError are now in utils.js

function scrollToBottom() {
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}
function autoResize() {
  elements.chatInput.style.height = 'auto';
  elements.chatInput.style.height = Math.min(elements.chatInput.scrollHeight, 120) + 'px';
}
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
// METHODS DROPDOWN
// =====================================================================
function renderMethodsDropdown(filter = 'all') {
  if (!elements.methodsList) return;
  const filtered = filter === 'all' ? methods : methods.filter(m => m.category === filter);
  elements.methodsList.innerHTML = '';
  filtered.forEach(method => {
    const el = document.createElement('div');
    el.className = 'method-item';
    el.innerHTML = `
      <div class="method-header">
        <div>
          <div class="method-name">${method.name}</div>
          <span class="method-tag tag-${method.category}">${method.tag}</span>
        </div>
        <div class="method-complexity">${method.complexityStars}</div>
      </div>
      <div class="method-description">${method.description}</div>`;
    el.addEventListener('click', () => selectMethod(method.key));
    elements.methodsList.appendChild(el);
  });
}
function selectMethod(methodKey) {
  selectedMethod = methodKey;
  closeDropdowns();
  const method = methods.find(m => m.key === methodKey);
  if (method) {
    // Clear the input field when selecting a method (in case Pro Tool text was there)
    elements.chatInput.value = '';
    elements.chatInput.placeholder = `Describe your situation for ${method.name} analysis...`;
    showToast(`Method selected: ${method.name}`);
  }
  elements.chatInput.focus();
}
function togglePerspectiveVisibility() {
  perspectiveVisibility = perspectiveVisibility === 'visible' ? 'invisible' : 'visible';
  showToast(`Perspective visibility: ${perspectiveVisibility}`);
}

// =====================================================================
// CHAT MESSAGES
// =====================================================================
function addMessage(type, content) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.innerHTML = type === 'user' ? escapeHtml(content) : convertMarkdownToHTML(content);
  elements.chatMessages.appendChild(div);
  scrollToBottom();
}
function addLoadingMessage() {
  const id = `loading-${Date.now()}`;
  const div = document.createElement('div');
  div.id = id;
  div.className = 'message assistant';
  div.innerHTML = `<div class="loading"><span>Analyzing</span>
      <div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>`;
  elements.chatMessages.appendChild(div);
  scrollToBottom();
  return id;
}
function removeLoadingMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}
function clearChat() {
  elements.chatMessages.innerHTML = '';
}

// =====================================================================
// SEND MESSAGE
// =====================================================================
async function sendMessage() {
  if (isLoading) return;
  const query = elements.chatInput.value.trim();
  if (!query) return;

  // ✅ Check if user is logged in
  const userId = getCurrentUserId();
  if (!userId) {
    showToast('Please log in to use the chat', 'error');
    return;
  }

  // Get attached file if any
  const fileInput = document.getElementById('fileInput');
  const attachedFile = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;

  // Display user message with file indicator
  const displayMessage = attachedFile
    ? `${query}\n\n📎 ${attachedFile.name} (${(attachedFile.size / 1024).toFixed(2)} KB)`
    : query;

  addMessage('user', displayMessage);
  elements.chatInput.value = '';
  autoResize();
  elements.sendButton.disabled = true;
  isLoading = true;
  const loadingId = addLoadingMessage();

  try {
    // Sending message with optional file
    const result = await mpaiAPI.analyze(query, selectedMethod, perspectiveVisibility, currentSessionId, attachedFile);
    removeLoadingMessage(loadingId);

    // Clear file input and hide badge after sending
    if (fileInput) fileInput.value = '';
    const badge = document.getElementById('fileAttachmentBadge');
    if (badge) badge.classList.add('hidden');
    
    if (result.success) {
      addMessage('assistant', result.response);
      
      // ✅ Ensure session ID consistency
      if (!currentSessionId) {
        currentSessionId = result.sessionId;
        console.log(`✨ New session: ${currentSessionId}`);
      } else {
        console.log(`🔄 Continuing session: ${currentSessionId}`);
      }

      // ✅ Show method used
      if (result.method) {
        const method = methods.find(m => m.key === result.method);
        if (method) showToast(`Used method: ${method.name}`, 'info');
      }

      // ✅ Context warnings (no cost info shown to users)
      if (result.contextInfo) {
        const { messageCount, estimatedTokens } = result.contextInfo;
        
        if (messageCount > 0) {
          console.log(`📚 Using ${messageCount} prior messages for context`);
        }
        
        // Warn if getting close to token limits (performance, not cost)
        if (estimatedTokens > 120000) {
          showToast(
            '⚠️ Conversation getting long. Consider starting a new session for better performance.',
            'warning'
          );
        } else if (estimatedTokens > 80000) {
          showToast(
            `📊 Using ${messageCount} prior messages. Conversation is getting long.`,
            'info'
          );
        }
      }

      // ✅ Reload sidebar with server-persisted entry
      await loadHistory();
      
    } else {
      // Check if this is a cost limit error
      if (result.costLimitExceeded) {
        if (result.monthlyLimitExceeded) {
          // Monthly limit exceeded - show detailed message
          const monthlyMessage = `
<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
  <div style="font-weight: 600; color: #991b1b; margin-bottom: 0.5rem; font-size: 16px;">
    ⚠️ Monthly Spending Limit Reached
  </div>
  <div style="color: #1f2937; line-height: 1.6;">
    <p style="margin: 0.5rem 0;">
      You've used <strong>$${(result.monthlyCost || 0).toFixed(2)}</strong> of your <strong>$${(result.monthlyLimit || 0).toFixed(2)}</strong> monthly limit.
    </p>
    <p style="margin: 0.5rem 0; font-size: 14px; color: #6b7280;">
      Your limit will reset at the start of next month. To continue using the service, please contact support to increase your monthly limit.
    </p>
  </div>
</div>`;
          addMessage('assistant', monthlyMessage);
          showToast('Monthly spending limit reached', 'error');
        } else {
          // Other cost limit exceeded (daily, per-request, etc.)
          const limitMessage = `
<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
  <div style="font-weight: 600; color: #991b1b; margin-bottom: 0.5rem; font-size: 16px;">
    ⚠️ Cost Limit Exceeded
  </div>
  <div style="color: #1f2937; line-height: 1.6;">
    <p style="margin: 0.5rem 0;">
      ${result.error || 'Your request exceeds the current cost limits.'}
    </p>
    <p style="margin: 0.5rem 0; font-size: 14px; color: #6b7280;">
      Please try again later or contact support for assistance.
    </p>
  </div>
</div>`;
          addMessage('assistant', limitMessage);
          showToast('Cost limit exceeded', 'error');
        }
      } else {
        // Generic error
        addMessage('assistant', `Error: ${result.error || 'Unknown error occurred'}`);
        showToast('Analysis failed', 'error');
      }
    }
  } catch (err) {
    removeLoadingMessage(loadingId);
    console.error('Send error:', err);
    addMessage('assistant', `Error: ${err.message}`);
    showToast('Failed to send message', 'error');
  } finally {
    elements.sendButton.disabled = false;
    isLoading = false;
    elements.chatInput.focus();
  }
}


// =====================================================================
// CONVERSATION HISTORY
// =====================================================================
async function loadHistory() {
  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      // User not authenticated
      elements.historyContent.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-title">Please log in</div>
          <div class="history-empty-text">Sign in to view your conversation history</div>
        </div>`;
      fullHistoryCache = [];
      return;
    }
    
    const res = await fetch(`/api/history/${userId}`);
    const data = await res.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      // No history
      elements.historyContent.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-title">No conversations yet</div>
          <div class="history-empty-text">Start a conversation to build your history</div>
        </div>`;
      fullHistoryCache = [];
      return;
    }
    
    fullHistoryCache = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    // History rendered
    
    // Group by session and render
    const sessions = groupBySession(fullHistoryCache);
    renderHistory(sessions);

    
  } catch (err) {
    console.error('❌ Error loading history:', err);
    elements.historyContent.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-title">Error loading history</div>
        <div class="history-empty-text">${err.message}</div>
      </div>`;
    fullHistoryCache = [];
  }
}

function renderFilteredHistory() {
  const searchTerm = document.getElementById('historySearch')?.value?.toLowerCase() || '';
  const now = new Date();
  
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 7);
  
  let filtered = fullHistoryCache.filter(item => {
    const text = `${item.user_query || ''} ${item.response || ''}`.toLowerCase();
    if (!text.includes(searchTerm)) return false;
    
    const ts = new Date(item.timestamp);
    if (isNaN(ts.getTime())) return false;
    
    if (activeFilter === 'today') {
      return ts >= startOfToday;
    } else if (activeFilter === 'week') {
      return ts >= startOfWeek;
    } else {
      return true;
    }
  });
  
  // Use grouped session view for consistent display
  const sessions = groupBySession(filtered);
  renderHistory(sessions);
}

function groupBySession(items) {
  const grouped = {};
  items.forEach(item => {
    const sid = item.session_id;
    if (!grouped[sid]) {
      grouped[sid] = {
        session_id: sid,
        timestamp: item.timestamp,
        exchanges: []
      };
    }
    grouped[sid].exchanges.push({
      user_query: item.user_query,
      response: item.response,
      timestamp: item.timestamp
    });
  });
  
  return Object.values(grouped).sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
}

function renderHistoryItems(historyData) {
  const container = document.getElementById("historyContent");
  container.innerHTML = "";

  if (!historyData.length) {
    container.innerHTML = `<div style="padding:1rem;color:var(--text-secondary);">No history yet</div>`;
    return;
  }

  historyData.forEach((item) => {
    const timeAgo = formatTimeAgo(item.timestamp || Date.now());
    const perspectives = item.perspectives || "5 perspectives";
    const method = item.method || "QUICK";
    const title = item.title || (item.user_query ? item.user_query.split(/[?.!]/)[0].slice(0, 60) : "Untitled Conversation");
    const preview = item.preview || "";

    const card = document.createElement("div");
    card.className = "history-item";

    card.innerHTML = `
      <div class="history-item-header">
        <div class="history-item-title">${title}</div>
        <div class="history-item-tag" data-type="${method}">${method}</div>
      </div>

      <div class="history-item-preview">${preview}</div>

      <div class="history-item-meta">
        <span>${perspectives}</span> • <span>${timeAgo}</span>
      </div>

      <div class="history-item-actions">
        <button class="btn-small" data-action="resume">Resume</button>
        <button class="btn-small" data-action="share">Share</button>
        <button class="btn-small" data-action="delete">Delete</button>
      </div>
    `;

    // Action buttons
    card.querySelector('[data-action="resume"]').onclick = () =>
      resumeConversation(item.id);
    card.querySelector('[data-action="share"]').onclick = () =>
      shareConversation(item.id);
    card.querySelector('[data-action="delete"]').onclick = () =>
      deleteConversation(item.id);

    container.appendChild(card);
  });
}

// formatTimeAgo moved to utils.js

function renderHistory(sessions) {
  if (!sessions || sessions.length === 0) {
    elements.historyContent.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-title">No conversations yet</div>
        <div class="history-empty-text">Start a conversation to build your history</div>
      </div>`;
    return;
  }
  
  let html = '';
  sessions.forEach(session => {
    const firstExchange = session.exchanges[0];
    const lastExchange = session.exchanges[session.exchanges.length - 1];
    
    // Title from first user query
    const title = firstExchange.user_query?.split(/[?.!]/)[0].slice(0, 60) || "Untitled Conversation";
    
    // Preview from last assistant response
    const preview = lastExchange.response 
      ? lastExchange.response.substring(0, 120) + '...'
      : firstExchange.user_query?.substring(0, 120) + '...' || '';
    
    // Format time
    const timeAgo = formatTimeAgo(session.timestamp);
    
    // Count exchanges
    const exchangeCount = session.exchanges.length;
    const exchangeText = `${exchangeCount} exchange${exchangeCount !== 1 ? 's' : ''}`;
    
    html += `
      <div class="history-item" data-session-id="${session.session_id}" style="cursor: pointer;">
        <div class="history-item-header">
          <div class="history-item-title">${escapeHtml(title)}</div>
        </div>

        <div class="history-item-preview">${escapeHtml(preview)}</div>

        <div class="history-item-meta">
          <span>${exchangeText}</span> • <span>${timeAgo}</span>
        </div>

        <div class="history-item-actions">
          <button class="btn-small" onclick="event.stopPropagation(); window.shareSession('${session.session_id}', event)">Share</button>
          <button class="btn-small" onclick="event.stopPropagation(); window.deleteSession('${session.session_id}', event)">Delete</button>
        </div>
      </div>`;
  });

  elements.historyContent.innerHTML = html;

  // Add click event listeners to make cards clickable
  document.querySelectorAll('.history-item').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking on a button
      if (e.target.closest('.history-item-actions')) {
        return;
      }
      const sessionId = card.dataset.sessionId;
      if (sessionId) {
        loadSession(sessionId);
      }
    });

    // Re-apply active state if this card matches current session
    if (currentSessionId && card.dataset.sessionId === currentSessionId) {
      card.classList.add('active');
    }
  });
}

// Store sessionId to delete when user confirms
let pendingDeleteSessionId = null;

function showDeleteModal(sessionId) {
  pendingDeleteSessionId = sessionId;
  const deleteModal = document.getElementById('deleteModal');
  if (deleteModal) {
    deleteModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }
}

function hideDeleteModal() {
  const deleteModal = document.getElementById('deleteModal');
  if (deleteModal) {
    deleteModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    pendingDeleteSessionId = null;
  }
}

async function confirmDeleteSession() {
  if (!pendingDeleteSessionId) return;
  
  const sessionId = pendingDeleteSessionId;
  hideDeleteModal();
  
  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      showToast('Please log in first', 'error');
      return;
    }
    
    // Deleting session
    const res = await fetch(`/api/history/${userId}/${sessionId}`, { method: 'DELETE' });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Conversation deleted', 'success');
      await loadHistory();
      if (currentSessionId === sessionId) {
        currentSessionId = null;
        clearChat();
      }
    } else {
      showToast(data.error || 'Failed to delete conversation', 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete conversation', 'error');
  }
}

function deleteSession(sessionId, event) {
  event.stopPropagation();
  
  // ✅ Add validation
  if (!sessionId) {
    console.error("❌ deleteSession called with undefined sessionId");
    showToast('Invalid session ID', 'error');
    return;
  }
  
  // Show modal instead of confirm
  showDeleteModal(sessionId);
}

// Delete a specific analysis (not the whole session)
async function deleteAnalysis(userId, sessionId, analysisId, event) {
  event?.stopPropagation();
  
  if (!analysisId) {
    console.error("❌ No analysis_id provided");
    showToast('Cannot delete - missing analysis ID', 'error');
    return;
  }
  
  if (!confirm("Delete this specific analysis? This cannot be undone.")) {
    return;
  }
  
  try {
    // Deleting analysis
    
    const response = await fetch(`/api/history/${userId}/${sessionId}/${analysisId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
    }
    
    const result = await response.json();
    // Delete successful
    
    showToast('Analysis deleted');
    await loadHistory();
  } catch (err) {
    console.error('❌ Delete error:', err);
    showToast('Failed to delete analysis', 'error');
  }
}

async function shareSession(sessionId, event) {
  event.stopPropagation();

  const sessionData = fullHistoryCache.filter(item => item.session_id === sessionId);
  if (sessionData.length === 0) {
    showToast('Session not found', 'error');
    return;
  }

  // Get session title from first exchange
  const firstExchange = sessionData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
  const sessionTitle = firstExchange.user_query?.split(/[?.!]/)[0].slice(0, 60) || 'Multi-Perspective AI Conversation';

  // Build shareable text
  let shareText = `Multi-Perspective AI Conversation\n`;
  shareText += `${new Date(firstExchange.timestamp).toLocaleDateString()}\n`;
  shareText += `${'='.repeat(50)}\n\n`;

  sessionData.forEach((item, index) => {
    shareText += `Exchange ${index + 1}\n`;
    shareText += `${'-'.repeat(50)}\n\n`;
    shareText += `User: ${item.user_query}\n\n`;
    shareText += `Assistant: ${item.response}\n\n`;
  });

  shareText += `\n${'='.repeat(50)}\n`;
  shareText += `Generated by Multi-Perspective AI\n`;

  // Try native share API first (works on mobile and modern browsers!)
  if (navigator.share) {
    try {
      await navigator.share({
        title: sessionTitle,
        text: shareText
      });
      showToast('Shared successfully', 'success');
      return;
    } catch (err) {
      // User cancelled the share, or share failed
      if (err.name === 'AbortError') {
        // User cancelled - don't show error
        return;
      }
      console.warn('Native share failed, falling back to clipboard:', err);
      // Fall through to clipboard fallback
    }
  }

  // Fallback to clipboard
  try {
    await navigator.clipboard.writeText(shareText);
    showToast('Conversation copied to clipboard', 'success');
  } catch (err) {
    console.error('Copy failed:', err);
    showToast('Failed to copy to clipboard', 'error');
  }
}

async function loadSession(sessionId) {
  const sessionItems = fullHistoryCache.filter(i => i.session_id === sessionId);
  if (sessionItems.length === 0) return showToast('Session not found', 'error');

  clearChat();
  currentSessionId = sessionId; // ✅ store the resumed session globally
  selectedMethod = null; // ✅ clear any previously selected method
  showToast('Session resumed', 'success');

  sessionItems
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .forEach(i => {
      addMessage('user', i.user_query);
      addMessage('assistant', i.response);
    });

  elements.chatInput.placeholder = 'Continue your conversation...';
  elements.chatInput.focus();

  // Highlight the active card in history
  document.querySelectorAll('.history-item').forEach(card => {
    if (card.dataset.sessionId === sessionId) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // Only close history if not pinned (pinned sidebar should stay open)
  const isPinned = elements.historySidebar.classList.contains('pinned');
  if (!isPinned) {
    closeHistory();
  }
  // If pinned, sidebar stays open - don't do anything
}

function toggleHistory() {
  const isPinned = elements.historySidebar.classList.contains('pinned');
  
  // If pinned, just toggle open state (sidebar stays pinned, just slides in/out)
  if (isPinned) {
    elements.historySidebar.classList.toggle('open');
    return;
  }
  
  // Normal toggle behavior when not pinned
  elements.historySidebar.classList.toggle('open');
  elements.mainContent.classList.toggle('sidebar-open');
  if (elements.historySidebar.classList.contains('open')) {
    // Loading history
    loadHistory();
  }
}

function closeHistory() {
  const isPinned = elements.historySidebar.classList.contains('pinned');
  
  // If pinned, unpin it when closing
  if (isPinned) {
    togglePin(); // This will handle closing and unpinning
    return;
  }
  
  // Normal close behavior when not pinned
  elements.historySidebar.classList.remove('open');
  elements.mainContent.classList.remove('sidebar-open');
}

function togglePin() {
  const isPinned = elements.historySidebar.classList.contains('pinned');
  const pinButton = document.getElementById('historyPin');
  
  if (isPinned) {
    // Unpin: remove pinned class and close sidebar
    elements.historySidebar.classList.remove('pinned');
    elements.historySidebar.classList.remove('open');
    elements.mainContent.classList.remove('history-pinned');
    elements.mainContent.classList.remove('sidebar-open');
    pinButton.classList.remove('active');
  } else {
    // Pin: add pinned class and ensure sidebar is open
    elements.historySidebar.classList.add('pinned');
    elements.historySidebar.classList.add('open');
    elements.mainContent.classList.add('sidebar-open');
    elements.mainContent.classList.add('history-pinned');
    pinButton.classList.add('active');
    // Loading history when pinning
    loadHistory();
  }
}

function closeDropdowns() {
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
}

// =====================================================================
// EVENT LISTENERS
// =====================================================================
function setupEventListeners() {
  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const nav = document.querySelector('.nav');

  if (mobileMenuBtn && nav) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      nav.classList.toggle('mobile-open');
      mobileMenuBtn.classList.toggle('active');
    });

    // Close mobile menu when clicking nav items
    nav.querySelectorAll('.dropdown-item, #historyToggle, #newSessionBtn').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          nav.classList.remove('mobile-open');
          mobileMenuBtn.classList.remove('active');
        }
      });
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 &&
          nav.classList.contains('mobile-open') &&
          !nav.contains(e.target) &&
          !mobileMenuBtn.contains(e.target)) {
        nav.classList.remove('mobile-open');
        mobileMenuBtn.classList.remove('active');
      }
    });
  }

  elements.chatInput.addEventListener('input', autoResize);
  elements.chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  elements.sendButton.addEventListener('click', sendMessage);

  document.querySelectorAll('.dropdown').forEach(d => {
    const t = d.querySelector('.dropdown-toggle, .account-icon-button');
    if (t) {
      t.addEventListener('click', e => {
        e.stopPropagation();
        const wasOpen = d.classList.contains('open');
        closeDropdowns();
        if (!wasOpen) d.classList.add('open');
      });
    }
  });
  
  document.addEventListener('click', e => { 
    if (!e.target.closest('.dropdown')) closeDropdowns(); 
  });
  
  document.querySelectorAll('.filter-btn-small').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      document.querySelectorAll('.filter-btn-small').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMethodsDropdown(btn.getAttribute('data-filter'));
    });
  });
  
  document.getElementById('historyToggle')?.addEventListener('click', toggleHistory);
  document.getElementById('historyClose')?.addEventListener('click', closeHistory);
  document.getElementById('historyPin')?.addEventListener('click', togglePin);
  
  // Close history when clicking outside (only if not pinned)
  document.addEventListener('click', (e) => {
    const historySidebar = document.getElementById('historySidebar');
    const historyToggle = document.getElementById('historyToggle');
    const historyPin = document.getElementById('historyPin');
    
    // Don't close if pinned
    if (historySidebar && historySidebar.classList.contains('pinned')) {
      return;
    }
    
    if (historySidebar && 
        historySidebar.classList.contains('open') && 
        !historySidebar.contains(e.target) && 
        !historyToggle?.contains(e.target) &&
        !historyPin?.contains(e.target)) {
      closeHistory();
    }
  });
  
  document.getElementById('uploadButton')?.addEventListener('click', () => document.getElementById('fileInput').click());

  document.getElementById('fileInput')?.addEventListener('change', e => {
    const files = e.target.files;
    const badge = document.getElementById('fileAttachmentBadge');
    const fileName = document.getElementById('fileAttachmentName');
    const fileSize = document.getElementById('fileAttachmentSize');

    if (files.length > 0) {
      const file = files[0];
      const sizeKB = (file.size / 1024).toFixed(2);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const displaySize = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

      // Show the badge with file info
      if (fileName) fileName.textContent = file.name;
      if (fileSize) fileSize.textContent = displaySize;
      if (badge) badge.classList.remove('hidden');

      showToast(`📎 ${file.name} attached`, 'success');
    } else {
      // Hide badge if no file
      if (badge) badge.classList.add('hidden');
    }
  });

  // Handle remove file button
  document.getElementById('fileAttachmentRemove')?.addEventListener('click', () => {
    const fileInput = document.getElementById('fileInput');
    const badge = document.getElementById('fileAttachmentBadge');

    if (fileInput) fileInput.value = '';
    if (badge) badge.classList.add('hidden');
    showToast('Attachment removed', 'info');
  });
  
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  
  document.getElementById('newSessionBtn')?.addEventListener('click', () => {
    currentSessionId = null;
    clearChat();
    // Clear the text input for a fresh start
    elements.chatInput.value = '';
    elements.chatInput.placeholder = 'Describe your situation or ask a question...';
    // Clear active state from all history cards
    document.querySelectorAll('.history-item').forEach(card => {
      card.classList.remove('active');
    });
    showToast('🆕 Started a new conversation');
  });
  
  // History filter buttons
  document.querySelectorAll('.history-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.history-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter') || 'all';
      renderFilteredHistory();
    });
  });
  
  // History search
  document.getElementById('historySearch')?.addEventListener('input', () => {
    renderFilteredHistory();
  });
}

async function handleLogout() {
  try {
    // Clear conversation history from memory
    fullHistoryCache = [];
    currentSessionId = null;
    
    // Clear the UI
    elements.historyContent.innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--text-secondary);">
        <p>Please log in to view your conversation history.</p>
      </div>`;
    
    // Clear chat messages
    clearChat();
    
    // History cleared
    
    // Call the signOut function (expects it to be globally available from auth.js)
    if (typeof signOut === 'function') {
      await signOut();
    } else {
      console.error("❌ signOut function not found");
    }
    
  } catch (error) {
    console.error("❌ Error during logout:", error);
  }
}

// =====================================================================
// INITIALIZATION
// =====================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Check for logout success and show toast
  if (sessionStorage.getItem('logout_success') === 'true') {
    sessionStorage.removeItem('logout_success');
    // Small delay to ensure UI is ready
    setTimeout(() => {
      showToast('✅ Successfully logged out', 'success');
    }, 500);
  }
  
  renderMethodsDropdown('all');
  setupEventListeners();
  
  // Setup delete modal event listeners
  const deleteModal = document.getElementById('deleteModal');
  const cancelDeleteBtn = document.getElementById('cancelDelete');
  const confirmDeleteBtn = document.getElementById('confirmDelete');
  const closeDeleteModalBtn = document.getElementById('closeDeleteModal');
  
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', hideDeleteModal);
  }
  if (closeDeleteModalBtn) {
    closeDeleteModalBtn.addEventListener('click', hideDeleteModal);
  }
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', confirmDeleteSession);
  }
  
  // Close modal when clicking outside (on overlay/backdrop)
  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      // Close if clicking on the backdrop (the modal itself, not its children)
      if (e.target === deleteModal) {
        hideDeleteModal();
      }
    });
    
    // Prevent clicks inside modal container from closing the modal
    const modalContainer = deleteModal.querySelector('.modal-container');
    if (modalContainer) {
      modalContainer.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }
  
  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !deleteModal?.classList.contains('hidden')) {
      hideDeleteModal();
    }
  });

  try {
    const health = await mpaiAPI.health();
      // API health check complete
  } catch (error) {
    console.error('❌ API Health Check Failed:', error);
  }

  // Check if user is logged in and load history
  const userId = getCurrentUserId();
  
  if (userId) {
    try {
      await loadHistory();
        // History loaded
    } catch (err) {
      console.warn("⚠️ Failed to load history:", err);
    }
  } else {
    elements.historyContent.innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--text-secondary);">
        <p>Please log in to view your conversation history.</p>
      </div>`;
  }
});


// =====================================================================
// FAQ MODAL HANDLING
// =====================================================================
// Use config constants (loaded from config.js)
const faqMappings = window.FAQ_MAPPINGS;

// =====================================================================
// PRO TOOLS DROPDOWN
// =====================================================================
// Use config constants (loaded from config.js)
const proTools = window.PRO_TOOLS;

function populateProTools(category = 'coach') {
  const proToolsContent = document.getElementById('proToolsContent');
  if (!proToolsContent) return;
  
  proToolsContent.innerHTML = '';
  
  if (proTools[category].length === 0) {
    proToolsContent.innerHTML = `
      <div class="pro-tools-coming-soon">
        <div class="pro-tools-coming-icon">
          ${category === 'healthcare' ? '🏥' : '👔'}
        </div>
        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">
          ${category === 'healthcare' ? 'Healthcare Professional Tools' : 'Leadership Tools'}
        </div>
        <div style="font-size: 13px;">Coming Soon</div>
      </div>
    `;
    return;
  }
  
  proTools[category].forEach(tool => {
    const toolElement = document.createElement('div');
    toolElement.className = 'pro-tool-item';
    toolElement.innerHTML = `
      <div class="pro-tool-header">
        <span class="pro-tool-name">${tool.name}</span>
        <span class="pro-tool-badge">${tool.badge}</span>
      </div>
      <div class="pro-tool-desc">${tool.description}</div>
      <div class="pro-tool-activation">Activation: "${tool.activation}"</div>
    `;
    
    toolElement.addEventListener('click', () => {
      const activation = tool.activation;
      if (activation) {
        elements.chatInput.value = activation;
        elements.chatInput.focus();
        closeDropdowns();
      }
    });
    
    proToolsContent.appendChild(toolElement);
  });
}

// Initialize Pro Tools
populateProTools('coach');

// Pro Tools tab switching
document.querySelectorAll('.pro-tools-tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.pro-tools-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    populateProTools(btn.dataset.tab);
  });
});

// =====================================================================
// FAQ DROPDOWN
// =====================================================================
document.querySelectorAll('#faqDropdown .dropdown-item').forEach(item => {
  item.addEventListener('click', async () => {
    const title = item.querySelector('.dropdown-item-title')?.textContent?.trim();
    const section = faqMappings[title];
    try {
      const res = await fetch('/faq/moore-multiplicity-faq.html');
      const html = await res.text();
      const faqContent = document.getElementById('faqContent');
      faqContent.innerHTML = html;
      openModal(document.getElementById('faqModal'));
      setTimeout(() => {
        if (section) {
          const target = faqContent.querySelector(`#${section}`);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    } catch (err) {
      console.error('Error loading FAQ:', err);
    }
  });
});

// Modal helpers (accessibility + UX)
function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(
    'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
  )).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
}

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('hidden');
  document.body.classList.add('modal-open');

  const container = modalEl.querySelector('.modal-container');
  const focusables = getFocusableElements(container);
  const first = focusables[0] || container;
  const last = focusables[focusables.length - 1] || container;
  const previousActive = document.activeElement;

  // Store to restore later
  modalEl._restoreFocus = () => { previousActive && previousActive.focus && previousActive.focus(); };

  // Focus the first element
  setTimeout(() => first.focus(), 0);

  // Overlay click closes (only when clicking the backdrop, not inside container)
  modalEl._onClick = (e) => { if (e.target === modalEl) closeModal(modalEl); };
  modalEl.addEventListener('click', modalEl._onClick);

  // Esc to close
  modalEl._onKeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeModal(modalEl); }
    if (e.key === 'Tab') {
      // focus trap
      if (focusables.length === 0) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', modalEl._onKeydown);
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  document.body.classList.remove('modal-open');
  modalEl.removeEventListener('click', modalEl._onClick);
  document.removeEventListener('keydown', modalEl._onKeydown);
  if (modalEl._restoreFocus) modalEl._restoreFocus();
}

// Wire close buttons to use improved close
const faqModalEl = document.getElementById('faqModal');
const closeFaqModal = () => closeModal(faqModalEl);
document.getElementById('closeFaq').addEventListener('click', closeFaqModal);
document.getElementById('closeFaqFooter').addEventListener('click', closeFaqModal);

// =====================================================================
// ENHANCED HISTORY CARD RENDERING (ADDED LOGIC)
// =====================================================================

// This new renderer keeps your existing history logic intact but displays
// richer cards with tags, perspectives, and actions when called manually.
// You can toggle between this and your grouped session list view easily.
function renderEnhancedHistory(historyData) {
  const container = document.getElementById("historyContent");
  container.innerHTML = "";

  if (!Array.isArray(historyData) || !historyData.length) {
    container.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-title">No history yet</div>
        <div class="history-empty-text">Start a conversation to build your history</div>
      </div>`;
    return;
  }

  historyData.forEach((item) => {
    // ✅ Add defensive check for session_id
    if (!item.session_id) {
      console.warn("⚠️ Item missing session_id:", item);
      return; // Skip items without session_id
    }

    const timeAgo = formatTimeAgo(item.timestamp || Date.now());
    const perspectives = item.perspectives || "No perspectives";
    const method = item.method || "QUICK";
    const title = item.title || "Untitled Conversation";
    const preview = item.preview || (item.user_query ? item.user_query.slice(0, 120) + "..." : "");

    const card = document.createElement("div");
    card.className = "history-item";
    
    // ✅ Store session_id as data attribute
    card.dataset.sessionId = item.session_id;

    card.innerHTML = `
      <div class="history-item-header">
        <div class="history-item-title">${escapeHtml(title)}</div>
        <div class="history-item-tag" data-type="${method}">${method}</div>
      </div>

      <div class="history-item-preview">${escapeHtml(preview)}</div>

      <div class="history-item-meta">
        <span>${perspectives}</span> • <span>${timeAgo}</span>
      </div>

      <div class="history-item-actions">
        <button class="btn-small btn-resume" data-action="resume" data-id="${item.session_id}">Resume</button>
        <button class="btn-small btn-share" data-action="share" data-id="${item.session_id}">Share</button>
        <button class="btn-small btn-delete" data-action="delete" data-id="${item.session_id}">Delete</button>
      </div>
    `;

    // ✅ Hook up button actions - get session_id from the card's dataset
    const sessionId = item.session_id;
    
    card.querySelector('[data-action="resume"]').onclick = () => {
      // Resume clicked
      loadSession(sessionId);
    };
    
    card.querySelector('[data-action="share"]').onclick = (event) => {
      // Share clicked
      shareSession(sessionId, event);
    };
    
    card.querySelector('[data-action="delete"]').onclick = (event) => {
      const userId = getCurrentUserId();
      const analysisId = item.analysis_id;
      // Delete clicked
      
      if (!analysisId) {
        console.error("❌ No analysis_id found for item:", item);
        showToast('Cannot delete - missing analysis ID', 'error');
        return;
      }
      
      deleteAnalysis(userId, sessionId, analysisId, event);
    };

    container.appendChild(card);
  });
  
  // History cards rendered
}


// Optional utility if you want to call this from console or after load
window.renderEnhancedHistory = renderEnhancedHistory;

// =====================================================================
// EXPORTS FOR GLOBAL USE
// =====================================================================
window.selectMethod = selectMethod;
window.loadSession = loadSession;
window.togglePerspectiveVisibility = togglePerspectiveVisibility;
window.deleteSession = deleteSession;
window.deleteAnalysis = deleteAnalysis;
window.shareSession = shareSession;