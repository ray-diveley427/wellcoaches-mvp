// =====================================================================
// Multi-Perspective AI - Methods Module
// =====================================================================
// Methods dropdown rendering and selection logic

// State
let selectedMethod = null;
let perspectiveVisibility = 'visible';

// =====================================================================
// METHODS DROPDOWN RENDERING
// =====================================================================

/**
 * Render methods dropdown with optional filtering
 * @param {string} filter - Filter by category: 'all', 'beginner', 'intermediate', 'advanced'
 */
function renderMethodsDropdown(filter = 'all') {
  const methodsList = document.getElementById('methodsList');
  if (!methodsList) return;

  const methods = window.METHODS;
  if (!methods) {
    console.error('METHODS not loaded from config.js');
    return;
  }

  const filtered = filter === 'all' ? methods : methods.filter(m => m.category === filter);
  methodsList.innerHTML = '';

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
    methodsList.appendChild(el);
  });
}

/**
 * Select a method for analysis
 * @param {string} methodKey - Method key to select
 */
function selectMethod(methodKey) {
  const methods = window.METHODS;
  const method = methods.find(m => m.key === methodKey);

  if (method) {
    selectedMethod = methodKey;
    window.closeAllDropdowns();

    // Update input placeholder
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.value = '';
      chatInput.placeholder = `Describe your situation for ${method.name} analysis...`;
      chatInput.focus();
    }

    window.showToast(`Method selected: ${method.name}`);
  }
}

/**
 * Toggle perspective visibility
 */
function togglePerspectiveVisibility() {
  perspectiveVisibility = perspectiveVisibility === 'visible' ? 'invisible' : 'visible';
  window.showToast(`Perspective visibility: ${perspectiveVisibility}`);
}

/**
 * Get currently selected method
 * @returns {string|null} - Selected method key or null
 */
function getSelectedMethod() {
  return selectedMethod;
}

/**
 * Get perspective visibility setting
 * @returns {string} - 'visible' or 'invisible'
 */
function getPerspectiveVisibility() {
  return perspectiveVisibility;
}

/**
 * Clear selected method
 */
function clearSelectedMethod() {
  selectedMethod = null;
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.placeholder = 'Describe your situation or ask a question...';
  }
}

// =====================================================================
// METHOD FILTER BUTTONS
// =====================================================================

/**
 * Setup method filter buttons in dropdown
 */
function setupMethodFilters() {
  const methodsDropdown = document.getElementById('methodsDropdown');
  if (!methodsDropdown) return;

  const filterButtons = methodsDropdown.querySelectorAll('.filter-btn-small');

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Render with filter
      const filter = btn.getAttribute('data-filter') || 'all';
      renderMethodsDropdown(filter);
    });
  });
}

// =====================================================================
// EXPORTS
// =====================================================================
if (typeof window !== 'undefined') {
  window.renderMethodsDropdown = renderMethodsDropdown;
  window.selectMethod = selectMethod;
  window.togglePerspectiveVisibility = togglePerspectiveVisibility;
  window.getSelectedMethod = getSelectedMethod;
  window.getPerspectiveVisibility = getPerspectiveVisibility;
  window.clearSelectedMethod = clearSelectedMethod;
  window.setupMethodFilters = setupMethodFilters;
}
