// app.js - Multi-Perspective AI Main Application

const methodsDropdown = document.getElementById('methodsDropdown');
const methodsToggle = document.getElementById('methodsToggle');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const chatMessages = document.getElementById('chatMessages');

let currentSessionId = null;
let perspectiveVisibility = 'visible';
let selectedMethod = null;
// =====================================================================
// MARKDOWN TO HTML CONVERTER
// =====================================================================

function convertMarkdownToHTML(markdown) {
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code blocks
    html = html.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Lists
    html = html.replace(/^\- (.*?)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>');
    
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    return '<p>' + html + '</p>';
}
// =====================================================================
// DROPDOWN HANDLING
// =====================================================================

// Toggle dropdown
methodsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    methodsDropdown.classList.toggle('open');
});

// Close dropdown when clicking outside
document.addEventListener('click', () => {
    methodsDropdown.classList.remove('open');
});

// Handle method selection
document.querySelectorAll('.method-item').forEach(item => {
    item.addEventListener('click', () => {
        selectedMethod = item.dataset.method;
        chatInput.value = '';
        chatInput.focus();
        methodsDropdown.classList.remove('open');
        chatInput.placeholder = `Describe your situation for ${selectedMethod} analysis...`;
    });
});

// =====================================================================
// INPUT HANDLING
// =====================================================================

// Auto-resize textarea
chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Use suggestion chip
function useSuggestion(text) {
    chatInput.value = text;
    chatInput.focus();
    selectedMethod = null;
}

// Toggle perspective visibility
function togglePerspectiveVisibility() {
    perspectiveVisibility = perspectiveVisibility === 'visible' ? 'invisible' : 'visible';
    console.log(`👁️ Perspective visibility: ${perspectiveVisibility}`);
}

// =====================================================================
// MESSAGE HANDLING
// =====================================================================

// Send message
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Remove welcome message if present
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    // Add user message to chat
    const userMessage = document.createElement('div');
    userMessage.className = 'message user';
    userMessage.innerHTML = `
        <div class="message-avatar">U</div>
        <div class="message-content">${escapeHtml(message)}</div>
    `;
    chatMessages.appendChild(userMessage);

    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Disable send button
    sendButton.disabled = true;

    // Show loading indicator
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'message assistant';
    loadingMessage.innerHTML = `
        <div class="message-avatar">M</div>
        <div class="message-content">
            Analyzing<span class="loading-indicator"></span><span class="loading-indicator"></span><span class="loading-indicator"></span>
        </div>
    `;
    chatMessages.appendChild(loadingMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        // Call backend API
        const result = await mpaiAPI.analyze(
            message,
            selectedMethod,
            perspectiveVisibility,
            currentSessionId
        );

        if (result.success) {
            // Update session ID
            currentSessionId = result.sessionId;
            selectedMethod = null;

            // Remove loading message
            loadingMessage.remove();

            // Add AI response
            const aiMessage = document.createElement('div');
            aiMessage.className = 'message assistant';
            aiMessage.innerHTML = `
                <div class="message-avatar">M</div>
                <div class="message-content">
                    ${convertMarkdownToHTML(result.response)}
                </div>
            `;
            chatMessages.appendChild(aiMessage);
        } else {
            // Remove loading and show error
            loadingMessage.remove();
            const errorMessage = document.createElement('div');
            errorMessage.className = 'message assistant';
            errorMessage.innerHTML = `
                <div class="message-avatar">M</div>
                <div class="message-content">
                    <p><strong>Error:</strong> ${escapeHtml(result.error)}</p>
                </div>
            `;
            chatMessages.appendChild(errorMessage);
        }

        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (err) {
        loadingMessage.remove();
        console.error('Error:', err);
        
        const errorMessage = document.createElement('div');
        errorMessage.className = 'message assistant';
        errorMessage.innerHTML = `
            <div class="message-avatar">M</div>
            <div class="message-content">
                <p><strong>Error:</strong> ${escapeHtml(err.message)}</p>
            </div>
        `;
        chatMessages.appendChild(errorMessage);
    } finally {
        sendButton.disabled = false;
    }
}

// Send button click
sendButton.addEventListener('click', sendMessage);

// Send on Enter (but allow Shift+Enter for new line)
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// =====================================================================
// INITIALIZATION
// =====================================================================

// Check API health on page load
(async () => {
    const healthCheck = await mpaiAPI.health();
    console.log('✅ API Health:', healthCheck);
})();
