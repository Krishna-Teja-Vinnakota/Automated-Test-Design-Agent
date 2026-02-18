// ==================== STORAGE MANAGER ====================
const STORAGE_KEYS = {
    JIRA_TICKET_ID: 'qa_wizard_jira_ticket_id',
    JIRA_DATA: 'qa_wizard_jira_data',
    TICKET_TYPE: 'qa_wizard_ticket_type',
    EPIC_DATA: 'qa_wizard_epic_data',
    EPIC_TICKET_ID: 'qa_wizard_epic_ticket_id',
    SPEC_DATA: 'qa_wizard_spec_data',
    SCENARIOS_DATA: 'qa_wizard_scenarios_data',
    TEST_CODE_DATA: 'qa_wizard_test_code_data',
    EXECUTION_RESULTS: 'qa_wizard_execution_results',
    REVIEW_DATA: 'qa_wizard_review_data',
    CURRENT_STEP: 'qa_wizard_current_step',
    COMPLETED_STEPS: 'qa_wizard_completed_steps'
};

class StorageManager {
    save(key, data) {
        try {
            sessionStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Storage save error:', e);
            return false;
        }
    }

    load(key, defaultValue = null) {
        try {
            const item = sessionStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Storage load error:', e);
            return defaultValue;
        }
    }

    remove(key) { sessionStorage.removeItem(key); }

    clearAll() {
        Object.values(STORAGE_KEYS).forEach(key => sessionStorage.removeItem(key));
    }

    getWorkflowState() {
        return {
            currentStep: this.load(STORAGE_KEYS.CURRENT_STEP, 1),
            completedSteps: this.load(STORAGE_KEYS.COMPLETED_STEPS, []),
            jiraTicketId: this.load(STORAGE_KEYS.JIRA_TICKET_ID, ''),
            jiraData: this.load(STORAGE_KEYS.JIRA_DATA, null),
            specData: this.load(STORAGE_KEYS.SPEC_DATA, null),
            scenariosData: this.load(STORAGE_KEYS.SCENARIOS_DATA, null)
        };
    }

    markStepComplete(step) {
        const completed = this.load(STORAGE_KEYS.COMPLETED_STEPS, []);
        if (!completed.includes(step)) {
            completed.push(step);
            this.save(STORAGE_KEYS.COMPLETED_STEPS, completed);
        }
    }

    isStepComplete(step) {
        const completed = this.load(STORAGE_KEYS.COMPLETED_STEPS, []);
        return completed.includes(step);
    }

    canNavigateToStep(step) {
        if (step === 1) return true;
        return this.isStepComplete(step - 1);
    }
}

// ==================== API FUNCTIONS ====================
const API_BASE_URL = '/api';

async function apiPost(endpoint, data) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API POST error:', error);
        throw error;
    }
}

// ==================== ICONS ====================
const Icons = {
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`
};

// ==================== PAGE STATE ====================
const storage = new StorageManager();
let isEditing = false;

// ==================== PAGE INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    const state = storage.getWorkflowState();
    
    // Redirect if no spec data
    if (!state.specData) {
        window.location.href = '/pages/spec-generation.html';
        return;
    }
    
    // Set current step
    storage.save(STORAGE_KEYS.CURRENT_STEP, 3);
    
    // Update UI
    document.getElementById('ticket-display').innerHTML = `
        <span class="label">Ticket:</span>
        <span class="value">${state.jiraTicketId}</span>
    `;
    
    // Display epic badge if epic context exists
    const epicTicketId = storage.load(STORAGE_KEYS.EPIC_TICKET_ID);
    if (epicTicketId) {
        const epicBadge = document.getElementById('epic-badge');
        const epicBadgeId = document.getElementById('epic-badge-id');
        if (epicBadge && epicBadgeId) {
            epicBadgeId.textContent = epicTicketId;
            epicBadge.classList.remove('hidden');
        }
    }
    
    updateStepperUI();
    setupEventListeners();
    
    // Load or generate scenarios
    if (state.scenariosData && state.scenariosData.length > 0) {
        displayScenarios(state.scenariosData);
    } else {
        generateScenarios();
    }
});

function setupEventListeners() {
    document.getElementById('btn-back').addEventListener('click', () => {
        window.location.href = '/pages/spec-generation.html';
    });
    
    document.getElementById('btn-home').addEventListener('click', () => {
        window.location.href = '/index.html';
    });
    
    document.getElementById('btn-accept').addEventListener('click', openNotifyDialog);
    document.getElementById('btn-modify').addEventListener('click', openModifyDialog);
    document.getElementById('btn-regenerate').addEventListener('click', handleRegenerate);
    document.getElementById('btn-edit').addEventListener('click', handleEdit);
    document.getElementById('btn-save-edit').addEventListener('click', handleSaveEdit);
    document.getElementById('btn-cancel-edit').addEventListener('click', handleCancelEdit);
    
    document.getElementById('btn-cancel-modify').addEventListener('click', closeModifyDialog);
    document.getElementById('btn-apply-modify').addEventListener('click', handleModify);
    
    document.getElementById('btn-skip-notify').addEventListener('click', handleSkipNotify);
    document.getElementById('btn-send-notify').addEventListener('click', handleSendNotify);
    
    document.getElementById('btn-reset').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset? All progress will be lost.')) {
            storage.clearAll();
            window.location.href = '/pages/jira-input.html';
        }
    });
}

function updateStepperUI() {
    const state = storage.getWorkflowState();
    const steps = document.querySelectorAll('.step');
    const connectors = document.querySelectorAll('.step-connector');
    
    steps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'complete', 'clickable');
        
        if (stepNum === 3) {
            step.classList.add('active');
        } else if (state.completedSteps.includes(stepNum)) {
            step.classList.add('complete', 'clickable');
            step.querySelector('.step-number').innerHTML = Icons.check;
        }
        
        if (state.completedSteps.includes(stepNum) || stepNum <= 2) {
            step.classList.add('clickable');
            step.onclick = () => navigateToStep(stepNum);
        }
    });
    
    connectors.forEach((connector, index) => {
        connector.classList.remove('complete');
        if (state.completedSteps.includes(index + 1)) {
            connector.classList.add('complete');
        }
    });
}

function navigateToStep(step) {
    const pages = {
        1: '/pages/jira-input.html',
        2: '/pages/spec-generation.html',
        3: '/pages/test-scenarios.html',
        4: '/pages/test-code.html',
        5: '/pages/test-execution.html',
        6: '/pages/test-review.html'
    };
    
    if (storage.canNavigateToStep(step)) {
        storage.save(STORAGE_KEYS.CURRENT_STEP, step);
        window.location.href = pages[step];
    }
}

// ==================== SCENARIO GENERATION ====================
async function generateScenarios() {
    const state = storage.getWorkflowState();
    showLoading(true);
    updateGeneratingBadge(true);
    
    try {
        const response = await apiPost('/scenarios/generate', { 
            jiraTicketId: state.jiraTicketId 
        });
        
        if (response.success && response.scenarios) {
            // Normalize scenarios to ensure proper structure
            const normalizedScenarios = normalizeScenarios(response.scenarios);
            storage.save(STORAGE_KEYS.SCENARIOS_DATA, normalizedScenarios);
            displayScenarios(normalizedScenarios);
        } else {
            throw new Error(response.message || 'Failed to generate scenarios');
        }
    } catch (error) {
        alert(`Error generating scenarios: ${error.message}`);
    } finally {
        showLoading(false);
        updateGeneratingBadge(false);
    }
}

async function handleRegenerate() {
    storage.remove(STORAGE_KEYS.SCENARIOS_DATA);
    await generateScenarios();
}

async function handleModify() {
    const prompt = document.getElementById('modify-prompt').value.trim();
    if (!prompt) {
        alert('Please enter modification instructions');
        return;
    }
    
    const state = storage.getWorkflowState();
    closeModifyDialog();
    showLoading(true);
    updateGeneratingBadge(true);
    
    try {
        const response = await apiPost('/scenarios/modify', {
            jiraTicketId: state.jiraTicketId,
            userPrompt: prompt
        });
        
        if (response.success && response.scenarios) {
            const normalizedScenarios = normalizeScenarios(response.scenarios);
            storage.save(STORAGE_KEYS.SCENARIOS_DATA, normalizedScenarios);
            displayScenarios(normalizedScenarios);
            document.getElementById('modify-prompt').value = '';
        } else {
            throw new Error(response.message || 'Failed to modify scenarios');
        }
    } catch (error) {
        alert(`Error modifying scenarios: ${error.message}`);
    } finally {
        showLoading(false);
        updateGeneratingBadge(false);
    }
}

// ==================== EDIT FUNCTIONS ====================
function handleEdit() {
    const state = storage.getWorkflowState();
    const scenariosData = state.scenariosData || [];
    
    // Convert to JSON for editing
    const scenariosJson = JSON.stringify(scenariosData, null, 2);
    document.getElementById('scenarios-editor').value = scenariosJson;
    
    // Show edit mode
    document.getElementById('scenarios-list').classList.add('hidden');
    document.getElementById('edit-scenarios').classList.remove('hidden');
    isEditing = true;
    
    // Disable action buttons while editing
    document.getElementById('btn-modify').disabled = true;
    document.getElementById('btn-regenerate').disabled = true;
    document.getElementById('btn-edit').disabled = true;
}

function handleSaveEdit() {
    const editedText = document.getElementById('scenarios-editor').value;
    
    try {
        const scenariosData = JSON.parse(editedText);
        
        // Validate it's an array
        if (!Array.isArray(scenariosData)) {
            throw new Error('Scenarios must be an array');
        }
        
        // Normalize and save
        const normalizedScenarios = normalizeScenarios(scenariosData);
        storage.save(STORAGE_KEYS.SCENARIOS_DATA, normalizedScenarios);
        displayScenarios(normalizedScenarios);
        
        // Exit edit mode
        document.getElementById('edit-scenarios').classList.add('hidden');
        document.getElementById('scenarios-list').classList.remove('hidden');
        isEditing = false;
        
        // Re-enable action buttons
        document.getElementById('btn-modify').disabled = false;
        document.getElementById('btn-regenerate').disabled = false;
        document.getElementById('btn-edit').disabled = false;
    } catch (error) {
        alert(`Invalid JSON: ${error.message}`);
    }
}

function handleCancelEdit() {
    document.getElementById('edit-scenarios').classList.add('hidden');
    document.getElementById('scenarios-list').classList.remove('hidden');
    isEditing = false;
    
    // Re-enable action buttons
    document.getElementById('btn-modify').disabled = false;
    document.getElementById('btn-regenerate').disabled = false;
    document.getElementById('btn-edit').disabled = false;
}

// ==================== NORMALIZE SCENARIOS ====================
function normalizeScenarios(scenarios) {
    if (!Array.isArray(scenarios)) {
        return [];
    }
    
    return scenarios.map((scenario, index) => {
        // Handle various possible field names from LLM response
        return {
            id: scenario.id || scenario.scenarioId || scenario.testId || `TC-${String(index + 1).padStart(3, '0')}`,
            title: scenario.title || scenario.name || scenario.scenarioName || scenario.testName || 'Untitled Scenario',
            type: scenario.type || scenario.testType || scenario.category || 'Positive',
            priority: scenario.priority || scenario.severity || 'Medium',
            description: scenario.description || scenario.desc || scenario.summary || 'No description available',
            preconditions: normalizeArray(scenario.preconditions || scenario.prerequisites || scenario.setup),
            steps: normalizeArray(scenario.steps || scenario.testSteps || scenario.actions),
            expectedResult: scenario.expectedResult || scenario.expected || scenario.expectedOutcome || scenario.result || 'Expected result not specified',
            testData: scenario.testData || scenario.data || {}
        };
    });
}

function normalizeArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
}

// ==================== NOTIFY DEVELOPER ====================
async function handleSkipNotify() {
    closeNotifyDialog();
    await acceptAndProceed();
}

async function handleSendNotify() {
    const state = storage.getWorkflowState();
    const email = document.getElementById('developer-email').value.trim();
    
    if (!email) {
        alert('Please enter developer email');
        return;
    }
    
    const sendBtn = document.getElementById('btn-send-notify');
    const cancelBtn = document.getElementById('btn-skip-notify');
    
    // Disable buttons and show loading
    sendBtn.disabled = true;
    cancelBtn.disabled = true;
    
    // Change button text and add spinner
    const originalText = sendBtn.innerHTML;
    sendBtn.innerHTML = `
        <svg class="spinner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
            <line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/>
        </svg>
        Sending...
    `;
    
    try {
        await apiPost('/scenarios/notify', {
            jiraTicketId: state.jiraTicketId,
            developerEmail: email
        });
        
        // Show success view
        document.getElementById('notify-form').classList.add('hidden');
        document.getElementById('notify-success').classList.remove('hidden');
        
        // Auto-close after 2 seconds
        setTimeout(async () => {
            closeNotifyDialog();
            await acceptAndProceed(); // Also accept scenarios and proceed
        }, 2000);
    } catch (error) {
        alert(`Error: ${error.message}`);
        
        // Restore button state
        sendBtn.innerHTML = originalText;
        sendBtn.disabled = false;
        cancelBtn.disabled = false;
    }
}

async function acceptAndProceed() {
    const state = storage.getWorkflowState();
    
    try {
        // Save scenarios to backend (MongoDB)
        await apiPost('/scenarios/accept', { 
            jiraTicketId: state.jiraTicketId 
        });
        
        // Mark step as complete
        storage.markStepComplete(3);
        storage.save(STORAGE_KEYS.CURRENT_STEP, 4);
        
        // Navigate to next step
        window.location.href = '/pages/test-code.html';
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// ==================== DISPLAY FUNCTIONS ====================
function displayScenarios(scenarios) {
    const list = document.getElementById('scenarios-list');
    list.innerHTML = '';
    
    // Update count
    document.getElementById('scenario-count').textContent = `${scenarios.length} scenarios generated`;
    
    scenarios.forEach((scenario, index) => {
        const item = document.createElement('div');
        item.className = 'scenario-item';
        item.innerHTML = `
            <div class="scenario-header">
                <span class="scenario-id">${scenario.id || `TC-${String(index + 1).padStart(3, '0')}`}</span>
                <span class="scenario-title">${scenario.title || 'Untitled Scenario'}</span>
                <div class="scenario-badges">
                    <span class="badge ${getTypeBadgeClass(scenario.type)}">${scenario.type || 'Positive'}</span>
                    <span class="badge ${getPriorityBadgeClass(scenario.priority)}">${scenario.priority || 'Medium'}</span>
                </div>
            </div>
            <div class="scenario-details">
                <div class="scenario-section">
                    <div class="scenario-section-title">Description</div>
                    <div class="scenario-section-content">
                        <p>${scenario.description || 'No description available'}</p>
                    </div>
                </div>
                ${scenario.preconditions && scenario.preconditions.length > 0 ? `
                <div class="scenario-section">
                    <div class="scenario-section-title">Preconditions</div>
                    <div class="scenario-section-content">
                        <ul class="scenario-steps">
                            ${scenario.preconditions.map(pre => `
                                <li class="scenario-step">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary); flex-shrink: 0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                    <span>${pre}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
                ` : ''}
                ${scenario.steps && scenario.steps.length > 0 ? `
                <div class="scenario-section">
                    <div class="scenario-section-title">Test Steps</div>
                    <div class="scenario-section-content">
                        <ul class="scenario-steps">
                            ${scenario.steps.map((step, i) => `
                                <li class="scenario-step">
                                    <span class="scenario-step-number">${i + 1}</span>
                                    <span>${step}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
                ` : ''}
                <div class="scenario-section">
                    <div class="scenario-section-title">Expected Result</div>
                    <div class="scenario-section-content scenario-expected">
                        <p>${scenario.expectedResult || 'Expected result not specified'}</p>
                    </div>
                </div>
            </div>
        `;
        
        // Toggle expand on click
        item.addEventListener('click', () => {
            item.classList.toggle('expanded');
        });
        
        list.appendChild(item);
    });
}

function getTypeBadgeClass(type) {
    if (!type) return 'badge-positive';
    const typeLower = type.toLowerCase();
    if (typeLower.includes('negative')) return 'badge-negative';
    if (typeLower.includes('boundary') || typeLower.includes('edge')) return 'badge-boundary';
    if (typeLower.includes('security')) return 'badge-security';
    if (typeLower.includes('ui') || typeLower.includes('ux')) return 'badge-ui';
    return 'badge-positive';
}

function getPriorityBadgeClass(priority) {
    if (!priority) return 'badge-medium';
    const priorityLower = priority.toLowerCase();
    if (priorityLower.includes('critical')) return 'badge-critical';
    if (priorityLower.includes('high')) return 'badge-high';
    if (priorityLower.includes('low')) return 'badge-low';
    return 'badge-medium';
}

// ==================== UI HELPERS ====================
function showLoading(show) {
    const loading = document.getElementById('loading-indicator');
    const list = document.getElementById('scenarios-list');
    
    if (show) {
        loading.classList.remove('hidden');
        list.innerHTML = '';
    } else {
        loading.classList.add('hidden');
    }
}

function updateGeneratingBadge(show) {
    const badge = document.getElementById('generating-badge');
    if (show) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function openModifyDialog() {
    document.getElementById('modify-dialog').classList.remove('hidden');
}

function closeModifyDialog() {
    document.getElementById('modify-dialog').classList.add('hidden');
}

function openNotifyDialog() {
    const dialog = document.getElementById('notify-dialog');
    const notifyForm = document.getElementById('notify-form');
    const notifySuccess = document.getElementById('notify-success');
    
    // Reset to form view
    notifyForm.classList.remove('hidden');
    notifySuccess.classList.add('hidden');
    
    // Clear previous input
    document.getElementById('developer-email').value = '';
    
    dialog.classList.remove('hidden');
}

function closeNotifyDialog() {
    document.getElementById('notify-dialog').classList.add('hidden');
}

function showNotifySuccess() {
    document.getElementById('notify-form').classList.add('hidden');
    document.getElementById('notify-success').classList.remove('hidden');
}
