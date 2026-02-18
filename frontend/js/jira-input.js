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

    remove(key) {
        sessionStorage.removeItem(key);
    }

    clearAll() {
        Object.values(STORAGE_KEYS).forEach(key => sessionStorage.removeItem(key));
    }

    // Get workflow state
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

    // Mark step as complete
    markStepComplete(step) {
        const completed = this.load(STORAGE_KEYS.COMPLETED_STEPS, []);
        if (!completed.includes(step)) {
            completed.push(step);
            this.save(STORAGE_KEYS.COMPLETED_STEPS, completed);
        }
    }

    // Check if step is complete
    isStepComplete(step) {
        const completed = this.load(STORAGE_KEYS.COMPLETED_STEPS, []);
        return completed.includes(step);
    }

    // Check if can navigate to step
    canNavigateToStep(step) {
        if (step === 1) return true;
        return this.isStepComplete(step - 1);
    }
}

// ==================== API FUNCTIONS ====================
const API_BASE_URL = '/api';

async function apiGet(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API GET error:', error);
        throw error;
    }
}

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

// ==================== SVG ICONS ====================
const Icons = {
    testTube: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5h0c-1.4 0-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/><path d="M14.5 16h-5"/></svg>`,
    sparkles: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`,
    rotateCcw: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    ticket: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>`,
    search: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    alertCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
    checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>`,
    arrowRight: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
    externalLink: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    loader: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/></svg>`
};

// ==================== PAGE INITIALIZATION ====================
const storage = new StorageManager();

document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupEventListeners();
    restoreState();
});

function initializePage() {
    // Set current step
    storage.save(STORAGE_KEYS.CURRENT_STEP, 1);
    
    // Update stepper UI
    updateStepperUI();
}

function setupEventListeners() {
    // Home button
    document.getElementById('btn-home').addEventListener('click', () => {
        window.location.href = '/index.html';
    });
    
    // Fetch button
    document.getElementById('btn-fetch').addEventListener('click', handleFetch);
    
    // Enter key on input
    document.getElementById('ticket-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleFetch();
    });
    
    // Proceed button
    document.getElementById('btn-proceed').addEventListener('click', handleProceed);
    
    // Reset button
    document.getElementById('btn-reset').addEventListener('click', handleReset);
    
    // Quick action buttons
    document.querySelectorAll('.quick-action').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('ticket-input').value = btn.textContent;
        });
    });
}

function restoreState() {
    const state = storage.getWorkflowState();
    
    // Restore ticket input if exists
    if (state.jiraTicketId) {
        document.getElementById('ticket-input').value = state.jiraTicketId;
    }
    
    // Restore ticket type if exists
    const ticketType = storage.load(STORAGE_KEYS.TICKET_TYPE, 'default');
    const ticketTypeRadio = document.querySelector(`input[name="ticketType"][value="${ticketType}"]`);
    if (ticketTypeRadio) {
        ticketTypeRadio.checked = true;
    }
    
    // Restore jira data if exists
    if (state.jiraData) {
        displayJiraData(state.jiraData);
    }
    
    // Restore epic data if exists
    const epicData = storage.load(STORAGE_KEYS.EPIC_DATA);
    const epicTicketId = storage.load(STORAGE_KEYS.EPIC_TICKET_ID);
    if (epicData && epicTicketId) {
        displayEpicContext(epicData, epicTicketId, 0); // No sibling count on restore
    }
}

function updateStepperUI() {
    const state = storage.getWorkflowState();
    const steps = document.querySelectorAll('.step');
    const connectors = document.querySelectorAll('.step-connector');
    
    steps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'complete', 'clickable');
        
        if (stepNum === state.currentStep) {
            step.classList.add('active');
        } else if (state.completedSteps.includes(stepNum)) {
            step.classList.add('complete', 'clickable');
            step.querySelector('.step-number').innerHTML = Icons.check;
        }
        
        // Add click handler for completed steps
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

// ==================== EVENT HANDLERS ====================
async function handleFetch() {
    const ticketInput = document.getElementById('ticket-input');
    const ticketId = ticketInput.value.trim().toUpperCase();
    const ticketType = document.querySelector('input[name="ticketType"]:checked').value;
    const errorMsg = document.getElementById('error-message');
    const loading = document.getElementById('loading-indicator');
    const fetchBtn = document.getElementById('btn-fetch');
    
    // Validate input
    if (!ticketId) {
        showError('Please enter a Jira Ticket ID');
        return;
    }
    
    // Hide error, show loading
    errorMsg.classList.add('hidden');
    loading.classList.remove('hidden');
    fetchBtn.disabled = true;
    fetchBtn.innerHTML = `<span class="spinner-small"></span> Fetching...`;
    
    try {
        const response = await apiPost('/fetch-jira', {
            jiraTicketId: ticketId,
            ticketType: ticketType
        });
        
        if (response.success && response.jiraData) {
            // Save to storage
            storage.save(STORAGE_KEYS.JIRA_TICKET_ID, ticketId);
            storage.save(STORAGE_KEYS.JIRA_DATA, response.jiraData);
            storage.save(STORAGE_KEYS.TICKET_TYPE, ticketType);
            
            // Save epic data if present
            if (response.epicData) {
                storage.save(STORAGE_KEYS.EPIC_DATA, response.epicData);
                storage.save(STORAGE_KEYS.EPIC_TICKET_ID, response.epicTicketId);
            } else {
                storage.remove(STORAGE_KEYS.EPIC_DATA);
                storage.remove(STORAGE_KEYS.EPIC_TICKET_ID);
            }
            
            // Display data
            displayJiraData(response.jiraData);
            
            // Display epic context if available
            if (response.epicData) {
                const siblingCount = response.siblingTicketsCount || 0;
                displayEpicContext(response.epicData, response.epicTicketId, siblingCount);
            }
        } else {
            throw new Error(response.message || 'Failed to fetch ticket data');
        }
    } catch (error) {
        showError(`Error: ${error.message}`);
    } finally {
        loading.classList.add('hidden');
        fetchBtn.disabled = false;
        fetchBtn.innerHTML = `${Icons.search} Fetch`;
    }
}

function handleProceed() {
    // Mark step 1 as complete
    storage.markStepComplete(1);
    
    // Navigate to next step
    storage.save(STORAGE_KEYS.CURRENT_STEP, 2);
    window.location.href = '/pages/spec-generation.html';
}

function handleReset() {
    if (confirm('Are you sure you want to reset? All progress will be lost.')) {
        storage.clearAll();
        window.location.reload();
    }
}

// ==================== DISPLAY FUNCTIONS ====================
function showError(message) {
    const errorMsg = document.getElementById('error-message');
    errorMsg.innerHTML = `${Icons.alertCircle} <span>${message}</span>`;
    errorMsg.classList.remove('hidden');
}

function displayJiraData(jiraData) {
    const ticketId = storage.load(STORAGE_KEYS.JIRA_TICKET_ID);
    const fields = jiraData.fields || {};
    
    // Extract data
    const summary = fields.summary || 'No title available';
    const description = extractDescription(fields.description);
    const status = fields.status?.name || 'Unknown';
    const priority = fields.priority?.name || 'Medium';
    const issueType = fields.issuetype?.name || 'Story';
    const reporter = fields.reporter?.displayName || 'Unknown';
    const assignee = fields.assignee?.displayName || 'Unassigned';
    const created = fields.created ? new Date(fields.created).toLocaleDateString() : 'N/A';
    const updated = fields.updated ? new Date(fields.updated).toLocaleDateString() : 'N/A';
    
    // Get JIRA base URL from the self link in jiraData
    let jiraBaseUrl = '';
    if (jiraData.self) {
        // Extract base URL from self link (e.g., https://yourcompany.atlassian.net/rest/api/3/issue/12345)
        const selfUrl = new URL(jiraData.self);
        jiraBaseUrl = `${selfUrl.protocol}//${selfUrl.host}`;
    }
    
    // Update UI elements
    document.getElementById('ticket-title').textContent = summary;
    document.getElementById('ticket-id').textContent = ticketId;
    document.getElementById('ticket-status').textContent = status;
    document.getElementById('ticket-status').className = `badge ${getStatusBadgeClass(status)}`;
    document.getElementById('ticket-priority').textContent = priority;
    document.getElementById('ticket-priority').className = `badge ${getPriorityBadgeClass(priority)}`;
    document.getElementById('ticket-description').innerHTML = description; // ✅ Changed to innerHTML for HTML formatting
    
    // Update meta info
    document.getElementById('meta-type').textContent = issueType;
    document.getElementById('meta-reporter').textContent = reporter;
    document.getElementById('meta-assignee').textContent = assignee;
    document.getElementById('meta-updated').textContent = updated;
    
    // Setup external link button
    const externalLinkBtn = document.querySelector('.card-header .btn-ghost[title="Open in Jira"]');
    if (externalLinkBtn && jiraBaseUrl) {
        externalLinkBtn.onclick = (e) => {
            e.stopPropagation();
            window.open(`${jiraBaseUrl}/browse/${ticketId}`, '_blank');
        };
        externalLinkBtn.style.cursor = 'pointer';
    }
    
    // Extract and display acceptance criteria
    const criteria = extractAcceptanceCriteria(jiraData);
    const criteriaList = document.getElementById('acceptance-criteria');
    criteriaList.innerHTML = '';
    
    criteria.forEach((criterion, index) => {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = `
            <span class="list-item-number">${index + 1}</span>
            <span>${criterion}</span>
        `;
        criteriaList.appendChild(li);
    });
    
    // Show the data card
    document.getElementById('jira-data-card').classList.remove('hidden');
}

function getStatusBadgeClass(status) {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('done') || statusLower.includes('closed')) return 'badge-success';
    if (statusLower.includes('progress')) return 'badge-primary';
    if (statusLower.includes('review')) return 'badge-warning';
    return 'badge-default';
}

function getPriorityBadgeClass(priority) {
    const priorityLower = priority.toLowerCase();
    if (priorityLower.includes('critical') || priorityLower.includes('highest')) return 'badge-destructive';
    if (priorityLower.includes('high')) return 'badge-warning';
    if (priorityLower.includes('medium')) return 'badge-primary';
    return 'badge-default';
}

// ==================== EPIC DISPLAY FUNCTIONS ====================
function displayEpicContext(epicData, epicId, siblingCount = 0) {
    const epicSection = document.getElementById('epic-context-section');
    const epicIdBadge = document.getElementById('epic-id-badge');
    const epicSummary = document.getElementById('epic-summary');
    const epicDescription = document.getElementById('epic-description');
    
    epicIdBadge.textContent = epicId;
    
    // Add sibling count to summary if available
    let summaryText = epicData.fields.summary || 'No summary';
    if (siblingCount > 0) {
        summaryText += ` (${siblingCount} related user stories)`;
    }
    epicSummary.textContent = summaryText;
    
    // Extract description
    const description = epicData.fields.description;
    let descText = '';
    
    if (typeof description === 'object' && description.content) {
        // ADF format
        descText = extractTextFromADF(description);
    } else if (typeof description === 'string') {
        descText = description;
    }
    
    epicDescription.textContent = descText || 'No description available';
    
    // Show the section
    epicSection.classList.remove('hidden');
}

function extractTextFromADF(adf) {
    let text = '';
    if (adf.content) {
        adf.content.forEach(node => {
            if (node.content) {
                node.content.forEach(item => {
                    if (item.type === 'text') {
                        text += item.text + ' ';
                    }
                });
            }
            text += '\n';
        });
    }
    return text.trim();
}

// ==================== DATA EXTRACTION HELPERS ====================
function extractDescription(description) {
    if (!description) return 'No description available';
    if (typeof description === 'string') return description;
    
    // Handle ADF (Atlassian Document Format) - Show EVERYTHING with proper formatting
    if (description.content) {
        let html = '';
        
        for (const item of description.content) {
            if (item.type === 'paragraph' && item.content) {
                const paraText = extractTextFromContent(item.content);
                if (paraText.trim()) {
                    html += `<p>${paraText}</p>`;
                }
            } else if (item.type === 'heading' && item.content) {
                const headingText = extractTextFromContent(item.content);
                if (headingText.trim()) {
                    html += `<h3 style="margin-top: 20px; margin-bottom: 10px; font-weight: 600; color: #2d3748;">${headingText}</h3>`;
                }
            } else if (item.type === 'bulletList' || item.type === 'orderedList') {
                const listItems = extractListItems(item.content || []);
                if (listItems.length > 0) {
                    html += item.type === 'orderedList' ? '<ol style="margin-left: 20px; margin-bottom: 15px;">' : '<ul style="margin-left: 20px; margin-bottom: 15px;">';
                    listItems.forEach(listItem => {
                        html += `<li style="margin-bottom: 8px;">${listItem}</li>`;
                    });
                    html += item.type === 'orderedList' ? '</ol>' : '</ul>';
                }
            }
        }
        return html || 'No description available';
    }
    
    return 'No description available';
}

function extractTextFromContent(content) {
    if (!content || !Array.isArray(content)) return '';
    let text = '';
    for (const item of content) {
        if (item.type === 'text') {
            text += item.text || '';
        } else if (item.type === 'hardBreak') {
            text += '\n';
        } else if (item.content) {
            text += extractTextFromContent(item.content);
        }
    }
    return text;
}

function extractAcceptanceCriteria(jiraData) {
    const criteria = [];
    const description = jiraData.fields?.description;
    
    if (description && description.content) {
        let inAcceptanceCriteria = false;
        
        for (const item of description.content) {
            if (item.type === 'heading') {
                const headingText = extractTextFromContent(item.content || []);
                if (headingText.toLowerCase().includes('acceptance criteria')) {
                    inAcceptanceCriteria = true;
                    continue;
                } else if (inAcceptanceCriteria) {
                    break;
                }
            }
            
            if (inAcceptanceCriteria) {
                if (item.type === 'bulletList' || item.type === 'orderedList') {
                    const listItems = extractListItems(item.content || []);
                    criteria.push(...listItems);
                } else if (item.type === 'paragraph') {
                    // Also extract paragraphs within acceptance criteria section
                    const paraText = extractTextFromContent(item.content || []);
                    if (paraText && paraText.trim()) {
                        criteria.push(paraText.trim());
                    }
                }
            }
        }
    }
    
    // ✅ FIXED: Return empty array instead of generic items
    return criteria;
}

function extractListItems(content) {
    const items = [];
    for (const item of content) {
        if (item.type === 'listItem') {
            const text = extractTextFromContent(item.content || []);
            if (text) items.push(text);
        } else if (item.content) {
            items.push(...extractListItems(item.content));
        }
    }
    return items;
}
