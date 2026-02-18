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
            scenariosData: this.load(STORAGE_KEYS.SCENARIOS_DATA, null),
            testCodeData: this.load(STORAGE_KEYS.TEST_CODE_DATA, null),
            executionResults: this.load(STORAGE_KEYS.EXECUTION_RESULTS, null),
            reviewData: this.load(STORAGE_KEYS.REVIEW_DATA, null)
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
    wand: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>`,
    sparkles: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`
};

// ==================== PAGE STATE ====================
const storage = new StorageManager();
let isEditing = false;

// ==================== PAGE INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    const state = storage.getWorkflowState();
    
    // Redirect if no jira data
    if (!state.jiraData) {
        window.location.href = '/pages/jira-input.html';
        return;
    }
    
    // Set current step
    storage.save(STORAGE_KEYS.CURRENT_STEP, 2);
    
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
    
    // Load or generate spec
    if (state.specData) {
        displaySpec(state.specData);
    } else {
        generateSpec();
    }
});

function setupEventListeners() {
    document.getElementById('btn-back').addEventListener('click', () => {
        window.location.href = '/pages/jira-input.html';
    });
    
    document.getElementById('btn-home').addEventListener('click', () => {
        window.location.href = '/index.html';
    });
    
    document.getElementById('btn-accept').addEventListener('click', handleAccept);
    document.getElementById('btn-modify').addEventListener('click', openModifyDialog);
    document.getElementById('btn-regenerate').addEventListener('click', handleRegenerate);
    document.getElementById('btn-edit').addEventListener('click', handleEdit);
    document.getElementById('btn-save-edit').addEventListener('click', handleSaveEdit);
    document.getElementById('btn-cancel-edit').addEventListener('click', handleCancelEdit);
    document.getElementById('btn-cancel-modify').addEventListener('click', closeModifyDialog);
    document.getElementById('btn-apply-modify').addEventListener('click', handleModify);
    
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
        
        if (stepNum === 2) {
            step.classList.add('active');
        } else if (state.completedSteps.includes(stepNum)) {
            step.classList.add('complete', 'clickable');
            step.querySelector('.step-number').innerHTML = Icons.check;
        }
        
        if (state.completedSteps.includes(stepNum) || stepNum === 1) {
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

// ==================== SPEC GENERATION ====================
async function generateSpec() {
    const state = storage.getWorkflowState();
    showLoading(true);
    updateGeneratingBadge(true);
    
    try {
        const response = await apiPost('/spec/generate', { 
            jiraTicketId: state.jiraTicketId 
        });
        
        if (response.success && response.spec) {
            storage.save(STORAGE_KEYS.SPEC_DATA, response.spec);
            displaySpec(response.spec);
        } else {
            throw new Error(response.message || 'Failed to generate specification');
        }
    } catch (error) {
        alert(`Error generating specification: ${error.message}`);
        displaySpec({ error: error.message });
    } finally {
        showLoading(false);
        updateGeneratingBadge(false);
    }
}

async function handleRegenerate() {
    // Clear existing spec data
    storage.remove(STORAGE_KEYS.SPEC_DATA);
    await generateSpec();
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
        const response = await apiPost('/spec/modify', {
            jiraTicketId: state.jiraTicketId,
            userPrompt: prompt
        });
        
        if (response.success && response.spec) {
            storage.save(STORAGE_KEYS.SPEC_DATA, response.spec);
            displaySpec(response.spec);
            document.getElementById('modify-prompt').value = '';
        } else {
            throw new Error(response.message || 'Failed to modify specification');
        }
    } catch (error) {
        alert(`Error modifying specification: ${error.message}`);
    } finally {
        showLoading(false);
        updateGeneratingBadge(false);
    }
}

// ==================== EDIT FUNCTIONS ====================
function handleEdit() {
    const state = storage.getWorkflowState();
    const specData = state.specData;
    
    let specText = '';
    if (typeof specData === 'string') {
        specText = specData;
    } else if (specData && specData.content) {
        specText = specData.content;
    } else if (specData) {
        specText = JSON.stringify(specData, null, 2);
    }
    
    document.getElementById('spec-editor').value = specText;
    document.getElementById('spec-content').classList.add('hidden');
    document.getElementById('edit-spec').classList.remove('hidden');
    isEditing = true;
    
    // Disable action buttons while editing
    document.getElementById('btn-modify').disabled = true;
    document.getElementById('btn-regenerate').disabled = true;
    document.getElementById('btn-edit').disabled = true;
}

function handleSaveEdit() {
    const editedText = document.getElementById('spec-editor').value;
    
    // Try to parse as JSON, otherwise save as string
    let specData;
    try {
        specData = JSON.parse(editedText);
    } catch {
        specData = { content: editedText };
    }
    
    storage.save(STORAGE_KEYS.SPEC_DATA, specData);
    displaySpec(specData);
    
    document.getElementById('edit-spec').classList.add('hidden');
    document.getElementById('spec-content').classList.remove('hidden');
    isEditing = false;
    
    // Re-enable action buttons
    document.getElementById('btn-modify').disabled = false;
    document.getElementById('btn-regenerate').disabled = false;
    document.getElementById('btn-edit').disabled = false;
}

function handleCancelEdit() {
    document.getElementById('edit-spec').classList.add('hidden');
    document.getElementById('spec-content').classList.remove('hidden');
    isEditing = false;
    
    // Re-enable action buttons
    document.getElementById('btn-modify').disabled = false;
    document.getElementById('btn-regenerate').disabled = false;
    document.getElementById('btn-edit').disabled = false;
}

// ==================== ACCEPT & PROCEED ====================
async function handleAccept() {
    const state = storage.getWorkflowState();
    
    try {
        // Save spec to backend (MongoDB)
        await apiPost('/spec/accept', { 
            jiraTicketId: state.jiraTicketId 
        });
        
        // Mark step as complete
        storage.markStepComplete(2);
        storage.save(STORAGE_KEYS.CURRENT_STEP, 3);
        
        // Navigate to next step
        window.location.href = '/pages/test-scenarios.html';
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// ==================== UI HELPERS ====================
function showLoading(show) {
    const loading = document.getElementById('loading-indicator');
    const content = document.getElementById('spec-content');
    
    if (show) {
        loading.classList.remove('hidden');
        content.classList.add('hidden');
    } else {
        loading.classList.add('hidden');
        content.classList.remove('hidden');
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

function displaySpec(spec) {
    const content = document.getElementById('spec-content');
    
    let specText = '';
    if (typeof spec === 'string') {
        specText = spec;
    } else if (spec && spec.content) {
        specText = spec.content;
    } else if (spec && spec.error) {
        specText = `Error: ${spec.error}`;
    } else if (spec) {
        specText = JSON.stringify(spec, null, 2);
    }
    
    // Format the spec content with basic markdown-like styling
    content.innerHTML = formatSpecContent(specText);
}

function formatSpecContent(text) {
    // Escape HTML
    let formatted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // Format headers
    formatted = formatted.replace(/^### (.+)$/gm, '<h3 style="color: var(--primary); margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1rem;">$1</h3>');
    formatted = formatted.replace(/^## (.+)$/gm, '<h2 style="color: var(--primary); margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1.125rem;">$1</h2>');
    formatted = formatted.replace(/^# (.+)$/gm, '<h1 style="color: var(--primary); margin-top: 0; margin-bottom: 1rem; font-size: 1.25rem;">$1</h1>');
    
    // Format code blocks
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre style="background: var(--secondary); padding: 1rem; border-radius: var(--radius); margin: 1rem 0; overflow-x: auto;">$2</pre>');
    
    // Format inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code style="background: var(--secondary); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">$1</code>');
    
    // Format bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Format lists
    formatted = formatted.replace(/^- (.+)$/gm, '<li style="margin-left: 1.5rem; color: var(--muted-foreground);">$1</li>');
    formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li style="margin-left: 1.5rem; color: var(--muted-foreground);">$1</li>');
    
    return formatted;
}

function openModifyDialog() {
    document.getElementById('modify-dialog').classList.remove('hidden');
}

function closeModifyDialog() {
    document.getElementById('modify-dialog').classList.add('hidden');
}
