// =====================================================================
// Multi-Perspective AI - Main Application
// Integrates with existing backend API (api.js)
// =====================================================================

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
      bottom: 2rem; right: 2rem;
      padding: 1rem 1.5rem;
      background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#14b8a6'};
      color: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 2000; animation: slideInUp 0.3s ease-out;`;
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
  function removeMessage(id) {
    const m = document.getElementById(id);
    if (m) m.remove();
  }
  
  // =====================================================================
  // SEND MESSAGE
  // =====================================================================
  async function sendMessage() {
    const message = elements.chatInput.value.trim();
    if (!message || isLoading) return;
    const welcome = elements.chatMessages.querySelector('.message.assistant:first-child');
    if (welcome && welcome.textContent.includes('Welcome')) welcome.remove();
  
    addMessage('user', message);
    elements.chatInput.value = '';
    autoResize();
    const loadingId = addLoadingMessage();
    isLoading = true; elements.sendButton.disabled = true;
  
    try {
      const result = await mpaiAPI.analyze(message, selectedMethod, perspectiveVisibility, currentSessionId);
      removeMessage(loadingId);
      if (result.success) {
        currentSessionId = result.sessionId;
        addMessage('assistant', result.response);
        selectedMethod = null;
        elements.chatInput.placeholder = 'Describe your situation or ask a question...';
          // ✅ Save full analysis to DynamoDB after AI response
        try {
            const conversation = {
            title: message.slice(0, 60),
            method: result.method || selectedMethod || 'QUICK',
            messages: [
                { role: 'user', content: message },
                { role: 'assistant', content: result.response }
            ],
            timestamp: Date.now()
            };
            await saveHistory(conversation);
             // ✅ Optional: silently refresh sidebar list even if closed
            if (!elements.historySidebar.classList.contains('open')) {
                await loadHistory();
            }
            console.log('💾 Conversation saved to DynamoDB');
        } catch (saveErr) {
            console.warn('⚠️ Failed to save conversation:', saveErr);
        }


        if (result.suggestions?.shouldSuggestSynthesis) showSynthesisSuggestion(result.suggestions.synthesisSuggestion);
        if (result.warnings?.longConversation) showToast(result.warnings.message, 'warning');
      } else {
        if (result.tokenLimitExceeded) {
          addMessage('assistant', 'Conversation too long. Starting new session...');
          setTimeout(() => { currentSessionId = null; clearChat(); }, 2000);
        } else addMessage('assistant', `Error: ${result.error}`);
      }
      if (document.getElementById('historySidebar').classList.contains('open')) {
        loadHistory();
      }      
    } catch (error) {
      removeMessage(loadingId);
      console.error('❌ Error sending message:', error);
      addMessage('assistant', `Error: ${error.message}`);
    } finally {
      isLoading = false;
      elements.sendButton.disabled = false;
      elements.chatInput.focus();
    }
  }
  function showSynthesisSuggestion(msg) {
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.style.background = 'linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)';
    div.style.borderColor = '#fbbf24';
    div.innerHTML = `<strong>💡 Suggestion:</strong> ${msg}`;
    elements.chatMessages.appendChild(div);
    scrollToBottom();
  }
  function clearChat() {
    elements.chatMessages.innerHTML = `
      <div class="message assistant">
        <div style="font-size:16px;">Welcome 👋</div>
        <div style="margin-top:0.5rem;">Tap <strong>Methods</strong> to choose an analysis approach, or tell me what's on your mind.</div>
      </div>`;
  }
  
  // =====================================================================
// HISTORY (DynamoDB Integration + Search + Actions)
// =====================================================================
let fullHistoryCache = [];
let activeFilter = 'all';

/**
 * Load saved analyses for the current user from DynamoDB
 */
async function loadHistory(userId = 'user-1') {
  try {
    const res = await fetch(`/api/history/${userId}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      elements.historyContent.innerHTML = `
        <div style="padding:2rem;text-align:center;color:var(--text-secondary);">
          <p>No conversation history yet.</p>
        </div>`;
      fullHistoryCache = [];
      return;
    }
    fullHistoryCache = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    renderFilteredHistory();
  } catch (err) {
    console.error('❌ Error loading history:', err);
  }
}

/**
 * Filter & search handling
 */
function renderFilteredHistory() {
    const searchTerm = document.getElementById('historySearch').value.toLowerCase();
    const now = new Date();
    
    // Midnight local time for "today"
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);
  
    let filtered = fullHistoryCache.filter(item => {
      const text = `${item.user_query || ''} ${item.response || ''}`.toLowerCase();
      if (!text.includes(searchTerm)) return false;
  
      const ts = new Date(item.timestamp);
      if (isNaN(ts.getTime())) return false; // skip invalid dates
  
      if (activeFilter === 'today') {
        return ts >= startOfToday;
      } else if (activeFilter === 'week') {
        return ts >= startOfWeek;
      } else {
        return true;
      }
    });
  
    const sessions = groupBySession(filtered);
    renderHistory(sessions);
  
    // Optional: update visible filter label
    document.querySelectorAll('.history-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          // Remove 'active' from all buttons
          document.querySelectorAll('.history-filter-btn').forEach(b => b.classList.remove('active'));
          
          // Add 'active' to clicked button
          btn.classList.add('active');
      
          // Update filter state
          activeFilter = btn.dataset.filter;
          
          // Refresh history list with new filter
          renderFilteredHistory();
        });
      });
      
      
  }
  

/**
 * Group DynamoDB items by session_id
 */
function groupBySession(items) {
  const sessions = {};
  items.forEach(i => {
    const id = i.session_id;
    if (!sessions[id]) sessions[id] = [];
    sessions[id].push(i);
  });
  return sessions;
}

/**
 * Render grouped history with buttons
 */
function renderHistory(sessions) {
  const container = elements.historyContent;
  container.innerHTML = '';
  Object.entries(sessions).forEach(([sessionId, items]) => {
    const latest = items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    const firstQuery = items[0]?.user_query || '(No query)';
    const lastResponse = latest?.response?.slice(0, 100) || '';

    const el = document.createElement('div');
    el.className = 'history-item';
    el.innerHTML = `
      <div class="history-item-body">
        <div class="history-item-title">${escapeHtml(firstQuery)}</div>
        <div class="history-item-preview">${escapeHtml(lastResponse)}</div>
        <div class="history-item-meta">
          <span>${latest.method || ''}</span>
          <span>${new Date(latest.timestamp).toLocaleString()}</span>
        </div>
      </div>
      <div class="history-item-actions">
        <button class="btn-small" data-action="resume" data-id="${sessionId}">Resume</button>
        <button class="btn-small" data-action="share" data-id="${sessionId}">Share</button>
        <button class="btn-small delete" data-action="delete" data-id="${sessionId}">Delete</button>
      </div>
    `;
    container.appendChild(el);
  });

  // Button actions
  container.querySelectorAll('.btn-small').forEach(btn => {
    btn.addEventListener('click', e => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'resume') loadSession(id);
      else if (action === 'share') shareSession(id);
      else if (action === 'delete') deleteSession(id);
    });
  });
}

/**
 * Load a specific session
 */
async function loadSession(sessionId) {
  const sessionItems = fullHistoryCache.filter(i => i.session_id === sessionId);
  if (sessionItems.length === 0) return showToast('Session not found', 'error');

  clearChat();
  currentSessionId = sessionId; // ✅ store the resumed session globally
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


/**
 * Share (copy to clipboard)
 */
function shareSession(sessionId) {
  const url = `${window.location.origin}?session=${sessionId}`;
  navigator.clipboard.writeText(url);
  showToast('Session link copied to clipboard!');
}

/**
 * Delete session (removes from DynamoDB)
 */
async function deleteSession(sessionId) {
    if (!confirm("Are you sure you want to permanently delete this session?")) return;
  
    try {
      const res = await fetch(`/api/history/user-1/${sessionId}`, { method: 'DELETE' });
      const data = await res.json();
  
      if (data.success) {
        // 👇 Fade-out animation before removing the session
        const el = document.querySelector(`[data-id="${sessionId}"]`)?.closest('.history-item');
        if (el) {
          el.classList.add('removed');
          setTimeout(() => el.remove(), 300);
        }
  
        fullHistoryCache = fullHistoryCache.filter(i => i.session_id !== sessionId);
        renderFilteredHistory();
        showToast('Session deleted successfully.', 'warning');
      } else {
        showToast('Failed to delete session.', 'error');
      }
    } catch (err) {
      console.error("❌ Error deleting session:", err);
      showToast('Error deleting session.', 'error');
    }
  }
  

  
  

  
  // =====================================================================
  // DROPDOWNS & HISTORY PANEL
  // =====================================================================
  function closeDropdowns() {
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
  }
  function toggleHistory() {
    elements.historySidebar.classList.toggle('open');
    elements.mainContent.classList.toggle('with-history');
    if (elements.historySidebar.classList.contains('open')) loadHistory();
  }
  function closeHistory() {
    elements.historySidebar.classList.remove('open');
    elements.mainContent.classList.remove('with-history');
  }
  
  // =====================================================================
  // EVENT LISTENERS
  // =====================================================================
  function setupEventListeners() {
    elements.sendButton.addEventListener('click', sendMessage);
    elements.chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    elements.chatInput.addEventListener('input', autoResize);
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
    document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) closeDropdowns(); });
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
    document.getElementById('uploadButton')?.addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput')?.addEventListener('change', e => {
      const files = e.target.files;
      if (files.length > 0) showToast(`${files.length} file(s) selected (upload feature coming soon)`);
    });
    // New Chat Button
    document.getElementById('newSessionBtn')?.addEventListener('click', () => {
      currentSessionId = null;
      clearChat();
      showToast('🆕 Started a new conversation');
    });
    
    async function toggleAuthButtons(isLoggedIn) {
      document.getElementById("loginBtn")?.classList.toggle("hidden", isLoggedIn);
      document.getElementById("logoutBtn")?.classList.toggle("hidden", !isLoggedIn);
    }

    async function initializeUserSession() {
      const user = await getCurrentUser();
      if (user) {
        console.log("✅ Logged in user:", user.username);
        showToast(`👋 Welcome, ${user.username}`);
      }
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
      console.log('✅ API Health:', health);
    } catch (error) {
      console.error('❌ API Health Check Failed:', error);
    }
  
    // ✅ Safe to load history *after* DOM and APIs are ready
    const token = localStorage.getItem("id_token");

    if (token) {
      try {
        await loadHistory();
        console.log("📜 History loaded for logged-in user");
      } catch (err) {
        console.warn("⚠️ Failed to load history:", err);
      }
    } else {
      document.getElementById("historyContent").innerHTML = `
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
        document.getElementById('faqModal').classList.remove('hidden');
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
  const closeFaqModal = () => document.getElementById('faqModal').classList.add('hidden');
  document.getElementById('closeFaq').addEventListener('click', closeFaqModal);
  document.getElementById('closeFaqFooter').addEventListener('click', closeFaqModal);
  
  // =====================================================================
  // EXPORTS FOR GLOBAL USE
  // =====================================================================
  window.selectMethod = selectMethod;
  window.loadSession = loadSession;
  window.togglePerspectiveVisibility = togglePerspectiveVisibility;
  