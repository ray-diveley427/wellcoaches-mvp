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

  // Close mobile menu when selecting a method on mobile
  if (window.innerWidth <= 768) {
    const nav = document.querySelector('.nav');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (nav && mobileMenuBtn) {
      nav.classList.remove('mobile-open');
      mobileMenuBtn.classList.remove('active');
    }
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

  // Get attached files if any
  const fileInput = document.getElementById('fileInput');
  const attachedFiles = fileInput && fileInput.files.length > 0 ? Array.from(fileInput.files) : [];

  // Display user message with file indicator(s)
  const displayMessage = attachedFiles && attachedFiles.length > 0
    ? `${query}\n\n📎 ${attachedFiles.map(f => `${f.name} (${(f.size / 1024).toFixed(2)} KB)`).join(', ')}`
    : query;

  addMessage('user', displayMessage);
  elements.chatInput.value = '';
  autoResize();
  elements.sendButton.disabled = true;
  isLoading = true;
  const loadingId = addLoadingMessage();

  try {
  // Sending message with optional files
  const filesToSend = attachedFiles.length > 0 ? attachedFiles : null;
  const result = await mpaiAPI.analyze(query, selectedMethod, perspectiveVisibility, currentSessionId, filesToSend);
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
        // Generic error - show user-friendly message
        const friendlyMessage = `
<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
  <div style="font-weight: 600; color: #991b1b; margin-bottom: 0.5rem; font-size: 16px;">
    ⚠️ We're experiencing technical difficulties
  </div>
  <div style="color: #1f2937; line-height: 1.6;">
    <p style="margin: 0.5rem 0;">
      We're sorry, but we're having trouble processing your request right now. This could be due to high demand or a temporary service interruption.
    </p>
    <p style="margin: 0.5rem 0; font-size: 14px; color: #6b7280;">
      Our team has been notified and is looking into it. Please try again in a few moments.
    </p>
  </div>
</div>`;
        addMessage('assistant', friendlyMessage);
        showToast('Request failed - please try again', 'error');

        // Log error details for admin (console only, not shown to user)
        console.error('Analysis error details:', result.error);
      }
    }
  } catch (err) {
    removeLoadingMessage(loadingId);
    console.error('Send error:', err);

    // User-friendly error message
    const friendlyMessage = `
<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
  <div style="font-weight: 600; color: #991b1b; margin-bottom: 0.5rem; font-size: 16px;">
    ⚠️ Connection Error
  </div>
  <div style="color: #1f2937; line-height: 1.6;">
    <p style="margin: 0.5rem 0;">
      We're having trouble connecting to our service. Please check your internet connection and try again.
    </p>
  </div>
</div>`;
    addMessage('assistant', friendlyMessage);
    showToast('Failed to send message', 'error');
  } finally {
    elements.sendButton.disabled = false;
    isLoading = false;
    elements.chatInput.focus();
    // Update download button visibility after message is sent
    updateDownloadButtonVisibility();
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
          <button class="btn-small" data-action="download" onclick="event.stopPropagation(); window.downloadSession('${session.session_id}', event)">Download</button>
          <button class="btn-small" data-action="share" onclick="event.stopPropagation(); window.shareSession('${session.session_id}', event)">Share</button>
          <button class="btn-small" data-action="delete" onclick="event.stopPropagation(); window.deleteSession('${session.session_id}', event)">Delete</button>
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

        // Auto-close history on mobile after selecting conversation
        if (window.innerWidth <= 768) {
          closeHistory();
        }
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

async function downloadSessionAsWord(sessionId, event) {
  if (event && event.stopPropagation) event.stopPropagation();

  const sessionData = fullHistoryCache.filter(item => item.session_id === sessionId);
  if (sessionData.length === 0) {
    showToast('Session not found', 'error');
    return;
  }

  // Sort by timestamp
  const sortedData = sessionData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const firstExchange = sortedData[0];
  const sessionTitle = firstExchange.user_query?.split(/[?.!]/)[0].slice(0, 60) || 'Multi-Perspective AI Conversation';
  const dateStr = new Date(firstExchange.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

  // Create Word document using docx library
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

  // Build document sections
  const children = [];

  // Title
  children.push(
    new Paragraph({
      text: sessionTitle,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 }
    })
  );

  // Metadata
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Date: ${new Date(firstExchange.timestamp).toLocaleDateString()}`,
          color: "666666",
          size: 20
        })
      ],
      spacing: { after: 100 }
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Conversation ID: ${sessionId}`,
          color: "666666",
          size: 20
        })
      ],
      spacing: { after: 400 }
    })
  );

  // Add each exchange
  sortedData.forEach((item, index) => {
    // Exchange header
    children.push(
      new Paragraph({
        text: `Exchange ${index + 1}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 }
      })
    );

    // User query
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'You:',
            bold: true,
            size: 22
          })
        ],
        spacing: { after: 100 }
      })
    );

    // Split user query into paragraphs
    const userQueryParagraphs = item.user_query.split('\n\n');
    userQueryParagraphs.forEach(para => {
      if (para.trim()) {
        children.push(
          new Paragraph({
            text: para.trim(),
            spacing: { after: 150 }
          })
        );
      }
    });

    // Assistant response
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Assistant:',
            bold: true,
            size: 22
          })
        ],
        spacing: { before: 200, after: 100 }
      })
    );

    // Split assistant response into paragraphs (preserving line breaks)
    const responseParagraphs = item.response.split('\n\n');
    responseParagraphs.forEach(para => {
      if (para.trim()) {
        children.push(
          new Paragraph({
            text: para.trim(),
            spacing: { after: 150 }
          })
        );
      }
    });
  });

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Generated by Multi-Perspective AI',
          color: "999999",
          size: 18
        })
      ],
      spacing: { before: 400 },
      alignment: AlignmentType.CENTER
    })
  );

  // Create document
  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  // Generate and download
  Packer.toBlob(doc).then(blob => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = `MPAI_${dateStr}_${sessionTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 30)}.docx`;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
    showToast('Conversation downloaded as Word document', 'success');
  }).catch(err => {
    console.error('Error generating Word document:', err);
    showToast('Failed to generate Word document', 'error');
  });
}

async function downloadSession(sessionId, event) {
  event.stopPropagation();

  const sessionData = fullHistoryCache.filter(item => item.session_id === sessionId);
  if (sessionData.length === 0) {
    showToast('Session not found', 'error');
    return;
  }

  // Sort by timestamp
  const sortedData = sessionData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const firstExchange = sortedData[0];
  const sessionTitle = firstExchange.user_query?.split(/[?.!]/)[0].slice(0, 60) || 'Multi-Perspective AI Conversation';
  const dateStr = new Date(firstExchange.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

  // Show download format choice modal
  showDownloadFormatModal(sessionId, sessionTitle, dateStr);
}

function showDownloadFormatModal(sessionId, sessionTitle, dateStr) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-container" style="max-width: 500px; height: auto;">
      <div class="modal-header">
        <h2 class="modal-title">Download Conversation</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body" style="padding: 2rem;">
        <p style="margin-bottom: 1.5rem; color: #64748b;">Choose your preferred download format:</p>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <button class="btn-primary" style="width: 100%; padding: 1rem; font-size: 1rem;" onclick="downloadSessionAsPDF('${sessionId}', '${sessionTitle}', '${dateStr}'); this.closest('.modal').remove();">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" style="display: inline-block; vertical-align: middle; margin-right: 0.5rem;">
              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
            </svg>
            Download as PDF
          </button>
          <button class="btn-primary" style="width: 100%; padding: 1rem; font-size: 1rem; background: #0ea5e9;" onclick="downloadSessionAsWord('${sessionId}', event); this.closest('.modal').remove();">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20" style="display: inline-block; vertical-align: middle; margin-right: 0.5rem;">
              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
            </svg>
            Download as Word Document
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function downloadSessionAsPDF(sessionId, sessionTitle, dateStr) {
  const sessionData = fullHistoryCache.filter(item => item.session_id === sessionId);
  const sortedData = sessionData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const firstExchange = sortedData[0];

  // Create PDF using jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - (margin * 2);
  let yPos = margin;

  // Helper function to add text with word wrap
  function addText(text, fontSize, isBold = false) {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, maxWidth);

    lines.forEach(line => {
      if (yPos > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
      doc.text(line, margin, yPos);
      yPos += fontSize * 0.5;
    });
  }

  // Title
  addText(sessionTitle, 16, true);
  yPos += 5;

  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Date: ${new Date(firstExchange.timestamp).toLocaleDateString()}`, margin, yPos);
  yPos += 5;
  doc.text(`Conversation ID: ${sessionId}`, margin, yPos);
  yPos += 10;

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Divider line
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Exchanges
  sortedData.forEach((item, index) => {
    // Exchange header
    addText(`Exchange ${index + 1}`, 12, true);
    yPos += 3;

    // User query
    addText('You:', 11, true);
    yPos += 2;
    addText(item.user_query, 10, false);
    yPos += 5;

    // Assistant response
    addText('Assistant:', 11, true);
    yPos += 2;
    addText(item.response, 10, false);
    yPos += 10;

    // Divider between exchanges
    if (index < sortedData.length - 1) {
      if (yPos > pageHeight - margin - 10) {
        doc.addPage();
        yPos = margin;
      }
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;
    }
  });

  // Footer
  yPos += 10;
  if (yPos > pageHeight - margin - 10) {
    doc.addPage();
    yPos = margin;
  }
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated by Multi-Perspective AI', margin, yPos);

  // Download PDF
  const filename = `MPAI_${dateStr}_${sessionTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 30)}.pdf`;
  doc.save(filename);

  showToast('Conversation downloaded as PDF', 'success');
}

function downloadCurrentConversation() {
  if (!currentSessionId) {
    showToast('No active conversation to download', 'warning');
    return;
  }

  // Use the existing downloadSession function
  downloadSession(currentSessionId, { stopPropagation: () => {} });
}

function updateDownloadButtonVisibility() {
  const downloadBtn = document.getElementById('downloadButton');
  if (!downloadBtn) return;

  // Show download button if there's a current session with messages
  const hasMessages = elements.chatMessages?.children?.length > 0;
  const hasSession = !!currentSessionId;

  if (hasSession && hasMessages) {
    downloadBtn.style.display = '';
  } else {
    downloadBtn.style.display = 'none';
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

  // Update download button visibility
  updateDownloadButtonVisibility();
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
  
  // Download current conversation button
  document.getElementById('downloadButton')?.addEventListener('click', downloadCurrentConversation);

  // Make upload button open the hidden file picker
  document.getElementById('uploadButton')?.addEventListener('click', () => document.getElementById('fileInput').click());

  // Clicking or dropping on the visible upload zone should also attach files
  const uploadZone = document.getElementById('uploadZone');
  const fileInputEl = document.getElementById('fileInput');
  const fileBadge = document.getElementById('fileAttachmentBadge');
  const fileName = document.getElementById('fileAttachmentName');
  const fileSize = document.getElementById('fileAttachmentSize');

  function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

  // Helper to apply a FileList to the hidden input and trigger UI update (supports multiple files)
  function applyFilesToInput(files) {
    if (!fileInputEl) return;
    const dt = new DataTransfer();
    for (let i = 0; i < files.length; i++) {
      dt.items.add(files[i]);
    }
    fileInputEl.files = dt.files;
    // Trigger change event to update the badge/list
    fileInputEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Wire the visible upload zone to open file picker on click
  if (uploadZone) {
    uploadZone.addEventListener('click', () => fileInputEl && fileInputEl.click());

    // Prevent default behavior for drag events on zone
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => uploadZone.addEventListener(ev, preventDefaults, false));

    // Visual highlight
    ['dragenter', 'dragover'].forEach(ev => uploadZone.addEventListener(ev, () => uploadZone.classList.add('drag-over'), false));
    ['dragleave', 'drop'].forEach(ev => uploadZone.addEventListener(ev, () => uploadZone.classList.remove('drag-over'), false));

    // Handle drop on upload zone
    uploadZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        applyFilesToInput(dt.files);
      }
    }, false);

    // Keyboard accessibility: open file picker on Enter/Space
    uploadZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInputEl && fileInputEl.click();
      }
    });
  }

  // Hidden file input change handler (updates badge/list and shows toast)
  const fileAttachmentList = document.getElementById('fileAttachmentList');
  const attachmentStatus = document.getElementById('attachmentStatus');

  function renderFileList() {
    if (!fileInputEl) return;
    const files = Array.from(fileInputEl.files || []);
    if (!files.length) {
      if (fileBadge) fileBadge.classList.add('hidden');
      if (fileAttachmentList) fileAttachmentList.innerHTML = '';
      if (attachmentStatus) attachmentStatus.textContent = '';
      return;
    }

    if (fileBadge) fileBadge.classList.remove('hidden');
    fileAttachmentList.innerHTML = '';
    files.forEach((f, idx) => {
  const li = document.createElement('div');
  li.className = 'file-attachment-item';
  li.setAttribute('role', 'listitem');
      const sizeKB = (f.size / 1024).toFixed(2);
      const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
      const displaySize = f.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
      li.innerHTML = `
        <div class="file-attachment-item-info">📎 <span class="file-name">${escapeHtml(f.name)}</span>
          <span class="file-size">${displaySize}</span>
        </div>
        <button class="file-remove-single" data-index="${idx}" title="Remove ${escapeHtml(f.name)}">✕</button>
      `;
      fileAttachmentList.appendChild(li);
    });

    // Update live region for screen readers
    if (attachmentStatus) attachmentStatus.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} attached: ${files.map(f => f.name).join(', ')}`;
  }

  function removeFileAtIndex(index) {
    if (!fileInputEl) return;
    const currentFiles = Array.from(fileInputEl.files || []);
    if (index < 0 || index >= currentFiles.length) return;
    const dt = new DataTransfer();
    currentFiles.forEach((f, i) => { if (i !== index) dt.items.add(f); });
    fileInputEl.files = dt.files;
    fileInputEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  fileInputEl?.addEventListener('change', e => {
    renderFileList();
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      showToast(`📎 ${files.length} file${files.length !== 1 ? 's' : ''} attached`, 'success');
    } else {
      showToast('All attachments removed', 'info');
    }
  });

  // Delegate click to remove single file buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.file-remove-single');
    if (btn) {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      if (!isNaN(idx)) removeFileAtIndex(idx);
    }
  });

  // Handle remove all files button
  document.getElementById('fileAttachmentRemove')?.addEventListener('click', () => {
    if (fileInputEl) fileInputEl.value = '';
    renderFileList();
    showToast('All attachments removed', 'info');
  });

  // Add drag-and-drop support to the textarea as well (fallback/extra UX)
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      chatInput.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      chatInput.addEventListener(eventName, () => chatInput.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      chatInput.addEventListener(eventName, () => chatInput.classList.remove('drag-over'), false);
    });

    chatInput.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        applyFilesToInput(dt.files);
      }
    }, false);
  }
  
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
    // Update download button visibility
    updateDownloadButtonVisibility();
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

  // Initialize download button visibility on page load
  updateDownloadButtonVisibility();
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
    const categoryTitles = {
      coach: 'Coach Professional Tools',
      healthcare: 'Healthcare Professional Tools',
      leader: 'Leadership Tools'
    };
    const categoryIcons = {
      coach: '🎯',
      healthcare: '🏥',
      leader: '👔'
    };
    proToolsContent.innerHTML = `
      <div class="pro-tools-coming-soon">
        <div class="pro-tools-coming-icon">
          ${categoryIcons[category] || '🔧'}
        </div>
        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">
          ${categoryTitles[category] || 'Professional Tools'}
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

        // Close mobile menu when selecting a pro tool on mobile
        if (window.innerWidth <= 768) {
          const nav = document.querySelector('.nav');
          const mobileMenuBtn = document.getElementById('mobileMenuBtn');
          if (nav && mobileMenuBtn) {
            nav.classList.remove('mobile-open');
            mobileMenuBtn.classList.remove('active');
          }
        }
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
window.downloadSession = downloadSession;
window.downloadSessionAsPDF = downloadSessionAsPDF;
window.downloadSessionAsWord = downloadSessionAsWord;
window.shareSession = shareSession;