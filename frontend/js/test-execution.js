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
            testCodeData: this.load(STORAGE_KEYS.TEST_CODE_DATA, null),
            executionResults: this.load(STORAGE_KEYS.EXECUTION_RESULTS, null)
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
    checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    xCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
    alertTriangle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`
};

// ==================== PAGE STATE ====================
const storage = new StorageManager();

// ==================== PAGE INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    const state = storage.getWorkflowState();
    
    // Redirect if no test code data
    if (!state.testCodeData) {
        window.location.href = '/pages/test-code.html';
        return;
    }
    
    // Set current step
    storage.save(STORAGE_KEYS.CURRENT_STEP, 5);
    
    // Update UI
    document.getElementById('ticket-display').innerHTML = `
        <span class="label">Ticket:</span>
        <span class="value">${state.jiraTicketId}</span>
    `;
    
    updateStepperUI();
    setupEventListeners();
    
    // Restore results if exists
    if (state.executionResults) {
        displayResults(state.executionResults);
    }
});

function setupEventListeners() {
    document.getElementById('btn-run').addEventListener('click', handleRunTests);
    
    document.getElementById('btn-back').addEventListener('click', () => {
        window.location.href = '/pages/test-code.html';
    });
    
    document.getElementById('btn-home').addEventListener('click', () => {
        window.location.href = '/index.html';
    });
    
    document.getElementById('btn-proceed').addEventListener('click', handleProceed);
    
    document.getElementById('btn-reset').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset? All progress will be lost.')) {
            storage.clearAll();
            window.location.href = '/pages/jira-input.html';
        }
    });
    
    // Verify URL button
    document.getElementById('btn-verify-url').addEventListener('click', verifyTargetUrl);
}

async function verifyTargetUrl() {
    const urlInput = document.getElementById('target-url');
    const statusDiv = document.getElementById('url-status');
    const url = urlInput.value.trim();
    
    if (!url) {
        statusDiv.innerHTML = '<span style="color: var(--destructive);">Please enter a URL</span>';
        statusDiv.classList.remove('hidden');
        return;
    }
    
    statusDiv.innerHTML = '<span style="color: var(--muted-foreground);">Checking...</span>';
    statusDiv.classList.remove('hidden');
    
    try {
        // Try to fetch the URL (this may fail due to CORS, but that's okay)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        await fetch(url, { 
            method: 'HEAD', 
            mode: 'no-cors',
            signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        statusDiv.innerHTML = '<span style="color: var(--success);">✓ URL appears to be reachable</span>';
    } catch (error) {
        if (error.name === 'AbortError') {
            statusDiv.innerHTML = '<span style="color: var(--warning);">⚠ Connection timed out - make sure your app is running</span>';
        } else {
            statusDiv.innerHTML = '<span style="color: var(--warning);">⚠ Could not verify - make sure your app is running at this URL</span>';
        }
    }
}

function updateStepperUI() {
    const state = storage.getWorkflowState();
    const steps = document.querySelectorAll('.step');
    const connectors = document.querySelectorAll('.step-connector');
    
    steps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'complete', 'clickable');
        
        if (stepNum === 5) {
            step.classList.add('active');
        } else if (state.completedSteps.includes(stepNum)) {
            step.classList.add('complete', 'clickable');
            step.querySelector('.step-number').innerHTML = Icons.check;
        }
        
        if (state.completedSteps.includes(stepNum) || stepNum <= 4) {
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

// ==================== TEST EXECUTION ====================
async function handleRunTests() {
    const state = storage.getWorkflowState();
    const runBtn = document.getElementById('btn-run');
    const progressSection = document.getElementById('execution-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const progressValue = document.getElementById('progress-value');
    const targetUrlSection = document.getElementById('target-url-section');
    
    // Get target URL
    const targetUrl = document.getElementById('target-url').value.trim() || 'http://localhost:5173';
    
    runBtn.disabled = true;
    runBtn.classList.add('hidden');
    targetUrlSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    
    // Simulate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 95) progress = 95;
        progressFill.style.width = `${progress}%`;
        progressValue.textContent = `${Math.round(progress)}%`;
    }, 300);
    
    try {
        const response = await apiPost('/tests/execute', { 
            jiraTicketId: state.jiraTicketId,
            targetUrl: targetUrl
        });
        
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        progressValue.textContent = '100%';
        
        if (response.success !== false) {
            storage.save(STORAGE_KEYS.EXECUTION_RESULTS, response.results || response);
            
            setTimeout(() => {
                progressSection.classList.add('hidden');
                displayResults(response.results || response);
            }, 500);
        } else {
            throw new Error(response.message || 'Test execution failed');
        }
    } catch (error) {
        clearInterval(progressInterval);
        progressSection.classList.add('hidden');
        targetUrlSection.classList.remove('hidden');
        runBtn.classList.remove('hidden');
        runBtn.disabled = false;
        alert(`Error executing tests: ${error.message}`);
    }
}

// ==================== DISPLAY FUNCTIONS ====================
function displayResults(results) {
    const resultsSection = document.getElementById('execution-results');
    const summarySection = document.getElementById('results-summary-section');
    const testResults = results.results?.testResults || results.testResults || [];
    
    // Calculate summary
    const total = testResults.length;
    const passed = testResults.filter(t => t.status === 'passed').length;
    const failed = testResults.filter(t => t.status === 'failed').length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    // Update summary
    document.getElementById('total-tests').textContent = total;
    document.getElementById('passed-tests').textContent = passed;
    document.getElementById('failed-tests').textContent = failed;
    document.getElementById('pass-rate').textContent = `${passRate}%`;
    
    // Update progress bar
    document.getElementById('overall-progress-fill').style.width = `${passRate}%`;
    document.getElementById('overall-duration').textContent = results.results?.duration || results.duration || '0s';
    
    // Display test results
    const list = document.getElementById('test-results-list');
    list.innerHTML = '';
    
    testResults.forEach((test, index) => {
        const item = document.createElement('div');
        item.className = `test-result-item ${test.status}`;
        
        // Format error message if exists
        let errorDisplay = '';
        if (test.error) {
            const errorMsg = test.error.message || test.error;
            // Clean up the error message - remove excessive technical details
            const cleanError = cleanErrorMessage(errorMsg);
            
            errorDisplay = `
                <div class="test-error">
                    <div class="test-error-title">
                        ${Icons.alertTriangle}
                        Error Details
                    </div>
                    <div class="test-error-message">${cleanError}</div>
                </div>
            `;
        }
        
        // Build the test item HTML
        item.innerHTML = `
            <div class="test-result-icon ${test.status}">
                ${test.status === 'passed' ? Icons.checkCircle : Icons.xCircle}
            </div>
            <div class="test-result-info">
                <div class="test-result-name">
                    <span class="test-result-id">${test.id || `TC-${String(index + 1).padStart(3, '0')}`}</span>
                    ${test.name || test.title || 'Test Case'}
                </div>
            </div>
            <div class="test-result-meta">
                <span class="test-result-duration">${test.duration || '-'}</span>
                <span class="badge ${test.status === 'passed' ? 'badge-success' : 'badge-error'}">
                    ${test.status === 'passed' ? 'Passed' : 'Failed'}
                </span>
            </div>
            <div class="test-result-details">
                ${test.status === 'passed' ? `
                    <div style="padding: 1rem; color: var(--success);">
                        ✓ Test passed successfully
                        <div style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--muted-foreground);">
                            Duration: ${test.duration || 'N/A'}
                        </div>
                    </div>
                ` : errorDisplay}
            </div>
        `;
        
        // Add click handler to toggle details
        item.addEventListener('click', (e) => {
            // Don't toggle if clicking on a link or button
            if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
                return;
            }
            item.classList.toggle('expanded');
        });
        
        list.appendChild(item);
    });
    
    // Show both sections
    summarySection.classList.remove('hidden');
    resultsSection.classList.remove('hidden');
    document.getElementById('btn-proceed').classList.remove('hidden');
}

function cleanErrorMessage(errorMsg) {
    if (!errorMsg) return 'Test failed';
    
    // Convert to string if it's an object
    if (typeof errorMsg === 'object') {
        errorMsg = JSON.stringify(errorMsg, null, 2);
    }
    
    // Remove Playwright internal paths and technical noise
    let cleaned = errorMsg
        .replace(/\|\|2m/g, ' ')
        .replace(/\[\d+m/g, '')
        .replace(/â€º/g, '›')
        .replace(/Locator:\s*locator\([^)]+\)/gi, '')
        .replace(/Call log:[\s\S]*?(?=Error:|Expected:|Received:|$)/gi, '')
        .replace(/page\.locator\([^)]+\)/g, 'element');
    
    // Extract the main error message (before the call log)
    const errorLines = cleaned.split('\n');
    const mainErrorLines = [];
    
    for (const line of errorLines) {
        // Stop at technical details
        if (line.includes('Call log:') ||
            line.includes('at ') ||
            line.includes('await expect') ||
            line.includes('page.locator')) {
            break;
        }
        
        // Keep meaningful lines
        if (line.trim() &&
            !line.includes('Timeout') ||
            !line.includes('10000ms')) {
            mainErrorLines.push(line.trim());
        }
    }
    
    // If we got something meaningful, use it
    if (mainErrorLines.length > 0) {
        return mainErrorLines.join('\n').substring(0, 500); // Limit to 500 chars
    }
    
    // Fallback to first 500 characters of cleaned message
    return cleaned.substring(0, 500).trim() || 'Test failed - see console for details';
}

function handleProceed() {
    storage.markStepComplete(5);
    storage.save(STORAGE_KEYS.CURRENT_STEP, 6);
    window.location.href = '/pages/test-review.html';
}
