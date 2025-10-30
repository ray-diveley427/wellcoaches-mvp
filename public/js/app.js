// =====================================================================
// Multi-Perspective AI - Main Application
// =====================================================================
// Note: This version expects auth.js functions to be available globally

// =====================================================================
// METHODS DATA WITH COMPLEXITY LEVELS
// =====================================================================
const methods = [
  { key: 'QUICK', name: 'QUICK', complexity: 1, complexityStars: '★☆☆☆☆', category: 'beginner', tag: 'BEGINNER', description: 'Get quick insights for daily decisions and straightforward situations. Perfect when you need guidance fast.' },
  { key: 'CONFLICT_RESOLUTION', name: 'CONFLICT', complexity: 2, complexityStars: '★★☆☆☆', category: 'beginner', tag: 'BEGINNER', description: 'Understand the core tension when you feel torn between two approaches. Validates both sides and finds a path forward.' },
  { key: 'STAKEHOLDER_ANALYSIS', name: 'STAKEHOLDER', complexity: 2, complexityStars: '★★☆☆☆', category: 'beginner', tag: 'BEGINNER', description: 'Understand perspectives of multiple people involved. Reveals hidden motivations and finds common ground.' },
  { key: 'NOTES_SUMMARY', name: 'NOTES SUMMARY', complexity: 2, complexityStars: '★★★☆☆', category: 'beginner', tag: 'BEGINNER', description: 'Organize any documents - for example, meeting notes, transcripts, or assessments - through relevant perspectives for clarity and insight.' },
  { key: 'PATTERN_RECOGNITION', name: 'PATTERN', complexity: 3, complexityStars: '★★★☆☆', category: 'intermediate', tag: 'INTERMEDIATE', description: 'Identify root causes of recurring problems and understand your role in perpetuating patterns.' },
  { key: 'SCENARIO_TEST', name: 'SCENARIO TEST', complexity: 3, complexityStars: '★★★☆☆', category: 'intermediate', tag: 'INTERMEDIATE', description: 'Thoroughly analyze 2-3 specific options to understand strengths, weaknesses, and hidden implications.' },
  { key: 'TIME_HORIZON', name: 'TIME HORIZON', complexity: 3, complexityStars: '★★★☆☆', category: 'intermediate', tag: 'INTERMEDIATE', description: 'Balance immediate needs with future consequences. See 1-year, 3-year, and 5-year perspectives.' },
  { key: 'HUMAN_HARM_CHECK', name: 'HUMAN HARM CHECK', complexity: 4, complexityStars: '★★★★☆', category: 'advanced', tag: 'ADVANCED', description: 'Comprehensive assessment of potential harms from major decisions. Identifies vulnerable populations and mitigation strategies.' },
  { key: 'FULL', name: 'FULL', complexity: 4, complexityStars: '★★★★☆', category: 'advanced', tag: 'ADVANCED', description: 'Full multi-perspective analysis considering all nine perspectives. For complex situations needing thorough understanding.' },
  { key: 'SIMPLE_SYNTHESIS', name: 'SYNTHESIS', complexity: 5, complexityStars: '★★★★★', category: 'advanced', tag: 'ADVANCED', description: 'Integrate insights from multiple analyses or explore across personal, relational, and systemic levels.' },
  { key: 'SYNTHESIS_ALL', name: 'SYNTHESIS (ALL)', complexity: 5, complexityStars: '★★★★★', category: 'advanced', tag: 'ADVANCED', description: 'Deep integration across individual, relational, and systemic levels. Most comprehensive analysis.' },
  { key: 'INNER_PEACE_SYNTHESIS', name: 'INNER PEACE SYNTHESIS', complexity: 5, complexityStars: '★★★★★', category: 'advanced', tag: 'ADVANCED', description: 'Resolve internal conflicts and improve well-being. Identify competing parts within yourself and find pathways to integration.' },
  { key: 'COACHING_PLAN', name: 'COACHING PLAN', complexity: 4, complexityStars: '★★★★☆', category: 'advanced', tag: 'ADVANCED', description: 'Transform analysis into actionable development plan with vision, strategies, and concrete next steps.' },
  { key: 'SKILLS', name: 'SKILLS', complexity: 4, complexityStars: '★★★★☆', category: 'advanced', tag: 'ADVANCED', description: 'Develop skills in applying any of the nine perspectives, based on the book: The Science of Leadership.' }
];

// =====================================================================
// STATE MANAGEMENT
// =====================================================================
let currentSessionId = null;
let perspectiveVisibility = 'visible';
let selectedMethod = null;
let isLoading = false;
let currentFilter = 'all';
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
function convertMarkdownToHTML(markdown) {
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
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
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
  currentFilter = filter;
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
  
  addMessage('user', query);
  elements.chatInput.value = '';
  autoResize();
  elements.sendButton.disabled = true;
  isLoading = true;
  const loadingId = addLoadingMessage();
  
  try {
    // Sending message
    const result = await mpaiAPI.analyze(query, selectedMethod, perspectiveVisibility, currentSessionId);
    removeLoadingMessage(loadingId);
    
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
      addMessage('assistant', `Error: ${result.error || 'Unknown error occurred'}`);
      showToast('Analysis failed', 'error');
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

function formatTimeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}


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
      <div class="history-item" data-session-id="${session.session_id}">
        <div class="history-item-header">
          <div class="history-item-title">${escapeHtml(title)}</div>
        </div>
        
        <div class="history-item-preview">${escapeHtml(preview)}</div>
        
        <div class="history-item-meta">
          <span>${exchangeText}</span> • <span>${timeAgo}</span>
        </div>
        
        <div class="history-item-actions">
          <button class="btn-small" onclick="window.loadSession('${session.session_id}')">Resume</button>
          <button class="btn-small" onclick="window.shareSession('${session.session_id}', event)">Share</button>
          <button class="btn-small" onclick="window.deleteSession('${session.session_id}', event)">Delete</button>
        </div>
      </div>`;
  });
  
  elements.historyContent.innerHTML = html;
}

async function deleteSession(sessionId, event) {
  event.stopPropagation();
  
  // ✅ Add validation
  if (!sessionId) {
    console.error("❌ deleteSession called with undefined sessionId");
    showToast('Invalid session ID', 'error');
    return;
  }
  
  // Deleting session
  
  if (!confirm('Delete this conversation? This cannot be undone.')) return;
  
  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      showToast('Please log in first', 'error');
      return;
    }
    
    // Deleting session
    
    const res = await fetch(`/api/history/${userId}/${sessionId}`, { method: 'DELETE' });
    const data = await res.json();
    
    // Delete response received
    
    if (data.success) {
      showToast('Conversation deleted', 'success');
      await loadHistory();
      if (currentSessionId === sessionId) {
        currentSessionId = null;
        clearChat();
      }
    } else {
      showToast('Failed to delete conversation', 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete conversation', 'error');
  }
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

function shareSession(sessionId, event) {
  event.stopPropagation();
  
  const sessionData = fullHistoryCache.filter(item => item.session_id === sessionId);
  if (sessionData.length === 0) {
    showToast('Session not found', 'error');
    return;
  }
  
  // Build shareable text
  let shareText = '--- Conversation Export ---\n\n';
  sessionData
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .forEach(item => {
      shareText += `User: ${item.user_query}\n\n`;
      shareText += `Assistant: ${item.response}\n\n`;
      shareText += '---\n\n';
    });
  
  // Copy to clipboard
  navigator.clipboard.writeText(shareText)
    .then(() => {
      showToast('Conversation copied to clipboard', 'success');
    })
    .catch(err => {
      console.error('Copy failed:', err);
      showToast('Failed to copy to clipboard', 'error');
    });
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
  closeHistory();
}

function toggleHistory() {
  elements.historySidebar.classList.toggle('open');
  elements.mainContent.classList.toggle('sidebar-open');
  if (elements.historySidebar.classList.contains('open')) {
    // Loading history
    loadHistory();
  }
}

function closeHistory() {
  elements.historySidebar.classList.remove('open');
  elements.mainContent.classList.remove('sidebar-open');
}

function closeDropdowns() {
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
}

// =====================================================================
// EVENT LISTENERS
// =====================================================================
function setupEventListeners() {
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
  
  // Close history when clicking outside
  document.addEventListener('click', (e) => {
    const historySidebar = document.getElementById('historySidebar');
    const historyToggle = document.getElementById('historyToggle');
    
    if (historySidebar && 
        historySidebar.classList.contains('open') && 
        !historySidebar.contains(e.target) && 
        !historyToggle?.contains(e.target)) {
      closeHistory();
    }
  });
  
  document.getElementById('uploadButton')?.addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('fileInput')?.addEventListener('change', e => {
    const files = e.target.files;
    if (files.length > 0) showToast(`${files.length} file(s) selected (upload feature coming soon)`);
  });
  
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  
  document.getElementById('newSessionBtn')?.addEventListener('click', () => {
    currentSessionId = null;
    clearChat();
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
  renderMethodsDropdown('all');
  setupEventListeners();

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
const faqMappings = {
  "What is Multi-Perspective AI?": "overview",
  "The Nine Perspectives": "dimensions",
  "Who is this for?": "leadership",
  "Which method should I use?": "map",
  "Privacy & data security": "science"
};

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