// ==================== STORAGE MANAGER ====================
const STORAGE_KEYS = {
    JIRA_TICKET_ID: 'qa_wizard_jira_ticket_id',
    JIRA_DATA: 'qa_wizard_jira_data',
    SPEC_DATA: 'qa_wizard_spec_data',
    SCENARIOS_DATA: 'qa_wizard_scenarios_data',
    TEST_CODE_DATA: 'qa_wizard_test_code_data',
    EXECUTION_RESULTS: 'qa_wizard_execution_results',
    REVIEW_DATA: 'qa_wizard_review_data',
    CURRENT_STEP: 'qa_wizard_current_step',
    COMPLETED_STEPS: 'qa_wizard_completed_steps',
    FLOW_TYPE: 'qa_wizard_flow_type'
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
            flowType: this.load(STORAGE_KEYS.FLOW_TYPE, 'new_requirement')
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

async function apiPostFormData(endpoint, formData) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            body: formData
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
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
};

// ==================== PAGE STATE ====================
const storage = new StorageManager();
let selectedTestType = 'frontend';
let selectedFramework = 'playwright';
let uploadedFiles = [];
let activeCodeTab = 'upload';
let jiraDataLoaded = false;
let isEditMode = false;

// ==================== PAGE INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    const state = storage.getWorkflowState();
    
    // Set current step
    storage.save(STORAGE_KEYS.CURRENT_STEP, 4);
    
    // Check flow type
    const flowType = state.flowType;
    
    if (flowType === 'test_existing' || !state.scenariosData) {
        // Show JIRA input card for "Test Existing" flow or if no scenarios data
        document.getElementById('jira-input-card').classList.remove('hidden');
        document.getElementById('config-card').classList.add('hidden');
        
        // Pre-fill JIRA ID if available
        if (state.jiraTicketId) {
            document.getElementById('jira-id-input').value = state.jiraTicketId;
        }
    } else {
        // Coming from sequential flow - hide JIRA input, show config
        document.getElementById('jira-input-card').classList.add('hidden');
        document.getElementById('config-card').classList.remove('hidden');
        jiraDataLoaded = true;
        
        // Update ticket display
        document.getElementById('ticket-display').innerHTML = `
            <span class="label">Ticket:</span>
            <span class="value">${state.jiraTicketId}</span>
        `;
        document.getElementById('ticket-display').style.display = 'flex';
    }
    
    updateStepperUI();
    setupEventListeners();
    
    // Restore test code if exists
    if (state.testCodeData) {
        displayTestCode(state.testCodeData);
    }
});

function setupEventListeners() {
    // Home button
    document.getElementById('btn-home').addEventListener('click', () => {
        window.location.href = '/index.html';
    });
    
    // JIRA ID load button
    document.getElementById('btn-load-jira').addEventListener('click', handleLoadJira);
    document.getElementById('jira-id-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLoadJira();
    });
    
    // Test type selection
    document.getElementById('test-type-select').addEventListener('change', handleTestTypeChange);
    
    // Framework selection
    document.getElementById('framework-select').addEventListener('change', (e) => {
        selectedFramework = e.target.value;
    });
    
    // Code input tabs
    document.querySelectorAll('.code-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchCodeTab(tabName);
        });
    });
    
    // File upload
    document.getElementById('file-input').addEventListener('change', handleFileSelect);
    
    // Generate button
    document.getElementById('btn-generate').addEventListener('click', handleGenerate);
    
    // Copy button
    document.getElementById('btn-copy').addEventListener('click', handleCopy);
    
    // Download button
    document.getElementById('btn-download').addEventListener('click', handleDownload);
    
    // Edit button
    document.getElementById('btn-edit').addEventListener('click', handleEdit);
    
    // Navigation
    document.getElementById('btn-back').addEventListener('click', () => {
        const state = storage.getWorkflowState();
        if (state.flowType === 'test_existing') {
            window.location.href = '/index.html';
        } else {
            window.location.href = '/pages/test-scenarios.html';
        }
    });
    
    document.getElementById('btn-proceed').addEventListener('click', handleProceed);
}

function updateStepperUI() {
    const state = storage.getWorkflowState();
    const steps = document.querySelectorAll('.step');
    const connectors = document.querySelectorAll('.step-connector');
    
    steps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'complete', 'clickable');
        
        if (stepNum === 4) {
            step.classList.add('active');
        } else if (state.completedSteps.includes(stepNum) || stepNum < 4) {
            step.classList.add('complete', 'clickable');
            step.querySelector('.step-number').innerHTML = Icons.check;
        }
    });
    
    connectors.forEach((connector, index) => {
        connector.classList.remove('complete');
        if (index < 3) {
            connector.classList.add('complete');
        }
    });
}

// ==================== JIRA LOADING ====================
async function handleLoadJira() {
    const jiraId = document.getElementById('jira-id-input').value.trim().toUpperCase();
    
    if (!jiraId) {
        showJiraError('Please enter a JIRA Ticket ID');
        return;
    }
    
    const loadBtn = document.getElementById('btn-load-jira');
    const errorEl = document.getElementById('jira-error-message');
    const loadingEl = document.getElementById('jira-loading');
    const successEl = document.getElementById('jira-success');
    
    // Reset states
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');
    loadingEl.classList.remove('hidden');
    loadBtn.disabled = true;
    
    try {
        // Fetch requirement data from MongoDB
        const response = await apiGet(`/requirements/${jiraId}`);
        
        if (response.success) {
            // Store data in session
            storage.save(STORAGE_KEYS.JIRA_TICKET_ID, jiraId);
            storage.save(STORAGE_KEYS.JIRA_DATA, response.jiraData);
            storage.save(STORAGE_KEYS.SPEC_DATA, response.spec);
            storage.save(STORAGE_KEYS.SCENARIOS_DATA, response.testScenarios);
            
            // Show success
            loadingEl.classList.add('hidden');
            document.getElementById('jira-success-text').textContent = 
                `Loaded: ${response.testScenarios.length} scenarios found for ${jiraId}`;
            successEl.classList.remove('hidden');
            
            // Update ticket display
            document.getElementById('ticket-display').innerHTML = `
                <span class="label">Ticket:</span>
                <span class="value">${jiraId}</span>
            `;
            document.getElementById('ticket-display').style.display = 'flex';
            
            // Show config card after delay
            setTimeout(() => {
                document.getElementById('config-card').classList.remove('hidden');
                jiraDataLoaded = true;
            }, 1000);
        }
    } catch (error) {
        loadingEl.classList.add('hidden');
        showJiraError(error.message);
    } finally {
        loadBtn.disabled = false;
    }
}

function showJiraError(message) {
    const errorEl = document.getElementById('jira-error-message');
    errorEl.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        <span>${message}</span>
    `;
    errorEl.classList.remove('hidden');
}

// ==================== TEST TYPE & FRAMEWORK ====================
function handleTestTypeChange(e) {
    selectedTestType = e.target.value;
    const frameworkSelect = document.getElementById('framework-select');
    const categoriesGroup = document.getElementById('test-categories-group');
    
    if (selectedTestType === 'frontend') {
        // Show Playwright/Cypress options
        frameworkSelect.innerHTML = `
            <option value="playwright">Playwright</option>
            <option value="cypress">Cypress</option>
        `;
        selectedFramework = 'playwright';
        categoriesGroup.classList.add('hidden');
    } else {
        // Show Jest for backend
        frameworkSelect.innerHTML = `
            <option value="jest">Jest</option>
        `;
        selectedFramework = 'jest';
        categoriesGroup.classList.remove('hidden');
    }
}

// ==================== CODE INPUT TABS ====================
function switchCodeTab(tabName) {
    activeCodeTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.code-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.getElementById('upload-tab').classList.toggle('hidden', tabName !== 'upload');
    document.getElementById('paste-tab').classList.toggle('hidden', tabName !== 'paste');
}

// ==================== FILE HANDLING ====================
function handleFileSelect(e) {
    const newFiles = Array.from(e.target.files);
    // Add new files to existing list (allow multiple uploads)
    newFiles.forEach(file => {
        // Check if file already exists
        const exists = uploadedFiles.some(f => f.name === file.name && f.size === file.size);
        if (!exists) {
            uploadedFiles.push(file);
        }
    });
    updateFileList();
    // Reset input to allow selecting same file again
    e.target.value = '';
}

function updateFileList() {
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';
    
    uploadedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
            <button class="file-remove" data-index="${index}">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
        `;
        
        item.querySelector('.file-remove').addEventListener('click', () => {
            uploadedFiles.splice(index, 1);
            updateFileList();
        });
        
        fileList.appendChild(item);
    });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ==================== CODE GENERATION ====================
async function handleGenerate() {
    const state = storage.getWorkflowState();
    
    // Validate JIRA data is loaded
    if (!jiraDataLoaded && !state.scenariosData) {
        alert('Please load JIRA data first');
        return;
    }
    
    // Validate developer code
    const pastedCode = document.getElementById('code-textarea').value.trim();
    if (activeCodeTab === 'upload' && uploadedFiles.length === 0) {
        alert('Please upload at least one source code file');
        return;
    }
    if (activeCodeTab === 'paste' && !pastedCode) {
        alert('Please paste your source code');
        return;
    }
    
    // Get test categories for backend
    let testCategories = null;
    if (selectedTestType === 'backend') {
        const categories = [];
        if (document.getElementById('check-unit').checked) categories.push('unit');
        if (document.getElementById('check-integration').checked) categories.push('integration');
        
        if (categories.length === 0) {
            alert('Please select at least one test category');
            return;
        }
        testCategories = categories.join(',');
    }
    
    const generateBtn = document.getElementById('btn-generate');
    generateBtn.disabled = true;
    generateBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/></svg>
        Generating...
    `;
    
    const formData = new FormData();
    formData.append('jiraTicketId', state.jiraTicketId);
    formData.append('type', selectedTestType);
    formData.append('framework', selectedFramework);
    
    if (testCategories) {
        formData.append('testCategories', testCategories);
    }
    
    // Add code - either files or pasted text
    if (activeCodeTab === 'upload') {
        uploadedFiles.forEach(file => {
            formData.append('files', file);
        });
    } else {
        formData.append('developerCode', pastedCode);
    }
    
    try {
        const response = await apiPostFormData('/tests/generate', formData);
        
        if (response.success) {
            const testCodeData = {
                code: response.testCode,
                fileName: response.fileName,
                type: response.testType || selectedTestType,
                framework: response.framework || selectedFramework
            };
            storage.save(STORAGE_KEYS.TEST_CODE_DATA, testCodeData);
            displayTestCode(testCodeData);
        } else {
            throw new Error(response.message || 'Failed to generate test code');
        }
    } catch (error) {
        alert(`Error generating test code: ${error.message}`);
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            Generate Test Code
        `;
    }
}

// ==================== DISPLAY FUNCTIONS ====================
function displayTestCode(testCodeData) {
    document.getElementById('test-filename').textContent = testCodeData.fileName;
    document.getElementById('test-code-content').textContent = testCodeData.code || testCodeData.testCode || '';
    
    // Update framework badge
    const frameworkBadge = document.getElementById('framework-badge');
    frameworkBadge.textContent = testCodeData.framework.charAt(0).toUpperCase() + testCodeData.framework.slice(1);
    
    // Hint for .ts files: Windows may show a video icon; file is still test code — open with a code editor
    const downloadBtn = document.getElementById('btn-download');
    const fn = (testCodeData.fileName || '').toLowerCase();
    downloadBtn.title = fn.endsWith('.ts') || fn.endsWith('.tsx')
        ? 'Download test code. If the file shows a video icon, right-click → Open with → choose your code editor (e.g. VS Code).'
        : 'Download test code';
    
    document.getElementById('test-code-card').classList.remove('hidden');
    
    // Scroll to code card
    document.getElementById('test-code-card').scrollIntoView({ behavior: 'smooth' });
}

// ==================== ACTIONS ====================
function handleEdit() {
    const editBtn = document.getElementById('btn-edit');
    const codeContent = document.getElementById('test-code-content');
    const codeEditor = document.getElementById('test-code-editor');
    
    if (!isEditMode) {
        // Switch to edit mode
        isEditMode = true;
        codeEditor.value = codeContent.textContent;
        codeContent.classList.add('hidden');
        codeEditor.classList.remove('hidden');
        codeEditor.focus();
        
        editBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Save
        `;
        editBtn.classList.add('btn-primary');
        editBtn.classList.remove('btn-outline');
    } else {
        // Save and switch back to view mode
        isEditMode = false;
        const editedCode = codeEditor.value;
        codeContent.textContent = editedCode;
        codeContent.classList.remove('hidden');
        codeEditor.classList.add('hidden');
        
        // Update storage with edited code
        const state = storage.getWorkflowState();
        if (state.testCodeData) {
            state.testCodeData.code = editedCode;
            storage.save(STORAGE_KEYS.TEST_CODE_DATA, state.testCodeData);
        }
        
        editBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            Edit
        `;
        editBtn.classList.remove('btn-primary');
        editBtn.classList.add('btn-outline');
    }
}

async function handleCopy() {
    // Get code from editor if in edit mode, otherwise from pre element
    const code = isEditMode 
        ? document.getElementById('test-code-editor').value 
        : document.getElementById('test-code-content').textContent;
    try {
        await navigator.clipboard.writeText(code);
        const btn = document.getElementById('btn-copy');
        const originalText = btn.innerHTML;
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Copied!
        `;
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
    } catch (error) {
        alert('Failed to copy to clipboard');
    }
}

function handleDownload() {
    const state = storage.getWorkflowState();
    const testCodeData = state.testCodeData;
    
    if (!testCodeData || !(testCodeData.testCode || testCodeData.code)) {
        alert('No test code available to download');
        return;
    }
    
    const testCode = testCodeData.testCode || testCodeData.code;
    const fileName = testCodeData.fileName || 'test.spec.ts';
    
    // Get code from editor if in edit mode
    const code = isEditMode 
        ? document.getElementById('test-code-editor').value 
        : testCode;
    
    // Use text/plain so the file is always treated as code/text, not video.
    // (Windows often associates .ts with video; text/plain avoids that.)
    const mimeType = 'text/plain; charset=utf-8';
    
    // Create blob from the actual test code string
    const blob = new Blob([code], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`Downloaded: ${fileName}`);
}

function handleProceed() {
    // If in edit mode, save the changes first
    if (isEditMode) {
        const editedCode = document.getElementById('test-code-editor').value;
        const state = storage.getWorkflowState();
        if (state.testCodeData) {
            state.testCodeData.code = editedCode;
            storage.save(STORAGE_KEYS.TEST_CODE_DATA, state.testCodeData);
        }
    }
    
    storage.markStepComplete(4);
    storage.save(STORAGE_KEYS.CURRENT_STEP, 5);
    window.location.href = '/pages/test-execution.html';
}

// Add CSS for spinner animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    .animate-spin {
        animation: spin 1s linear infinite;
    }
`;
document.head.appendChild(style);
