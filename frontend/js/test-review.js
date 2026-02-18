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
    checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    xCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
    partyPopper: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/></svg>`,
    fileWarning: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
    alertTriangle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`
};

// ==================== PAGE STATE ====================
const storage = new StorageManager();

// ==================== PAGE INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    const state = storage.getWorkflowState();
    
    // Redirect if no execution results
    if (!state.executionResults) {
        window.location.href = '/pages/test-execution.html';
        return;
    }
    
    // Set current step
    storage.save(STORAGE_KEYS.CURRENT_STEP, 6);
    
    // Update UI
    document.getElementById('ticket-display').innerHTML = `
        <span class="label">Ticket:</span>
        <span class="value">${state.jiraTicketId}</span>
    `;
    
    updateStepperUI();
    setupEventListeners();
    
    // Load or generate review
    if (state.reviewData) {
        displayReview(state.reviewData);
    } else {
        generateReview();
    }
});

function setupEventListeners() {
    document.getElementById('btn-back').addEventListener('click', () => {
        window.location.href = '/pages/test-execution.html';
    });
    
    document.getElementById('btn-home').addEventListener('click', () => {
        window.location.href = '/index.html';
    });
    
    document.getElementById('btn-feedback').addEventListener('click', openFeedbackDialog);
    document.getElementById('btn-cancel-feedback').addEventListener('click', closeFeedbackDialog);
    document.getElementById('btn-send-feedback').addEventListener('click', handleSendFeedback);
    
    document.getElementById('btn-new').addEventListener('click', () => {
        if (confirm('Start a new test? All current progress will be cleared.')) {
            storage.clearAll();
            window.location.href = '/pages/jira-input.html';
        }
    });
    
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
        
        if (stepNum === 6) {
            step.classList.add('active');
        } else if (state.completedSteps.includes(stepNum)) {
            step.classList.add('complete', 'clickable');
            step.querySelector('.step-number').innerHTML = Icons.check;
        }
        
        if (state.completedSteps.includes(stepNum) || stepNum <= 5) {
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

// ==================== REVIEW GENERATION ====================
async function generateReview() {
    const state = storage.getWorkflowState();
    showLoading(true);
    
    try {
        const response = await apiPost('/tests/review', { 
            jiraTicketId: state.jiraTicketId 
        });
        
        if (response.success) {
            storage.save(STORAGE_KEYS.REVIEW_DATA, response);
            displayReview(response);
        } else {
            throw new Error(response.message || 'Failed to generate review');
        }
    } catch (error) {
        alert(`Error generating review: ${error.message}`);
        // Show basic review based on execution results
        const executionResults = state.executionResults;
        const testResults = executionResults?.results?.testResults || executionResults?.testResults || [];
        const failedTests = testResults.filter(t => t.status === 'failed');
        
        const basicReview = {
            passed: failedTests.length === 0,
            reasoning: failedTests.length === 0 
                ? 'All test scenarios passed successfully.'
                : `${failedTests.length} test scenario(s) failed.`,
            failedScenarios: failedTests.map(t => ({
                scenarioId: t.id,
                name: t.name || t.title,
                error: t.error?.message || 'Test failed',
                suggestion: 'Review the test case and fix the implementation.'
            })),
            recommendations: failedTests.length === 0
                ? ['All acceptance criteria have been met', 'Code is ready for deployment']
                : ['Fix the failing test cases', 'Review implementation against requirements']
        };
        
        storage.save(STORAGE_KEYS.REVIEW_DATA, basicReview);
        displayReview(basicReview);
    } finally {
        showLoading(false);
    }
}

// ==================== DISPLAY FUNCTIONS ====================
function displayReview(review) {
    const reviewResults = document.getElementById('review-results');
    const statusBanner = document.getElementById('status-banner');
    const failedSection = document.getElementById('failed-section');
    const recommendationsSection = document.getElementById('recommendations-section');
    
    const isPassed = review.passed;
    
    // Update status banner
    statusBanner.className = `status-banner ${isPassed ? 'passed' : 'failed'}`;
    statusBanner.innerHTML = `
        <div class="status-icon">
            ${isPassed ? Icons.partyPopper : Icons.fileWarning}
        </div>
        <h2 class="status-title">${isPassed ? 'Requirement Successfully Implemented!' : 'Issues Detected'}</h2>
        <p class="status-description">${review.reasoning || (isPassed ? 'All test scenarios passed successfully.' : 'Some test scenarios failed.')}</p>
        
        <div class="stats">
            <div class="stat">
                <span class="stat-value success">${review.passedCount || (review.passed ? 'All' : '0')}</span>
                <span class="stat-label">Passed</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
                <span class="stat-value error">${review.failedCount || (review.failedScenarios?.length || 0)}</span>
                <span class="stat-label">Failed</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
                <span class="stat-value">${review.totalCount || '-'}</span>
                <span class="stat-label">Total</span>
            </div>
        </div>
    `;
    
    // Show feedback/report button - always show it so user can post results to Jira
    document.getElementById('btn-feedback').classList.remove('hidden');
    document.getElementById('btn-feedback').textContent = isPassed ? 'Post Results to Jira' : 'Send Feedback to Developer';
    
    // Display failed tests
    if (!isPassed && review.failedScenarios && review.failedScenarios.length > 0) {
        failedSection.classList.remove('hidden');
        const failedList = document.getElementById('failed-tests-list');
        failedList.innerHTML = '';
        
        review.failedScenarios.forEach(scenario => {
            const item = document.createElement('div');
            item.className = 'failed-test-item';
            item.innerHTML = `
                <div class="failed-test-header">
                    ${Icons.xCircle}
                    <div>
                        <div class="failed-test-title">
                            <span class="failed-test-id">${scenario.scenarioId || 'N/A'}</span>
                            ${scenario.name || 'Test Case'}
                        </div>
                        <div class="failed-test-error">${scenario.error || 'Test failed'}</div>
                        ${scenario.suggestion ? `<div class="failed-test-suggestion"><strong>Suggestion:</strong> ${scenario.suggestion}</div>` : ''}
                    </div>
                </div>
            `;
            failedList.appendChild(item);
        });
    }
    
    // Display recommendations
    if (review.recommendations && review.recommendations.length > 0) {
        recommendationsSection.classList.remove('hidden');
        const recList = document.getElementById('recommendations-list');
        recList.innerHTML = '';
        
        review.recommendations.forEach(rec => {
            const item = document.createElement('li');
            item.className = 'recommendation-item';
            item.innerHTML = `${Icons.checkCircle}<span>${rec}</span>`;
            recList.appendChild(item);
        });
    }
    
    reviewResults.classList.remove('hidden');
}

// ==================== FEEDBACK ====================
function openFeedbackDialog() {
    const state = storage.getWorkflowState();
    const review = state.reviewData;
    const isPassed = review?.passed;
    
    // Update dialog title based on pass/fail
    const dialogTitle = document.querySelector('#feedback-dialog h3');
    if (dialogTitle) {
        dialogTitle.textContent = isPassed ? 'Post Results to Jira' : 'Send Feedback to Developer';
    }
    
    // Show/hide issues list based on whether there are failures
    const issuesSection = document.getElementById('issues-section');
    if (review && review.failedScenarios && review.failedScenarios.length > 0) {
        if (issuesSection) issuesSection.classList.remove('hidden');
        const issuesList = document.getElementById('issues-list');
        issuesList.innerHTML = '';
        review.failedScenarios.forEach(scenario => {
            const li = document.createElement('li');
            li.innerHTML = `${Icons.xCircle}<span>${scenario.scenarioId}: ${scenario.name || 'Test Case'}</span>`;
            issuesList.appendChild(li);
        });
    } else {
        if (issuesSection) issuesSection.classList.add('hidden');
    }
    
    document.getElementById('feedback-dialog').classList.remove('hidden');
    document.getElementById('feedback-form').classList.remove('hidden');
    document.getElementById('feedback-success').classList.add('hidden');
}

function closeFeedbackDialog() {
    document.getElementById('feedback-dialog').classList.add('hidden');
}

async function handleSendFeedback() {
    const state = storage.getWorkflowState();
    const email = document.getElementById('feedback-email').value.trim();
    const message = document.getElementById('feedback-message').value.trim();
    
    if (!email) {
        alert('Please enter developer email');
        return;
    }
    
    const sendBtn = document.getElementById('btn-send-feedback');
    const cancelBtn = document.getElementById('btn-cancel-feedback');
    
    // Disable buttons and show loading
    sendBtn.disabled = true;
    cancelBtn.disabled = true;
    
    // Change button text and add spinner
    const originalText = sendBtn.innerHTML;
    sendBtn.innerHTML = `
        <svg class="spinner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
            <line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/>
        </svg>
        Posting to Jira...
    `;
    
    try {
        await apiPost('/developer/feedback', {
            jiraTicketId: state.jiraTicketId,
            developerEmail: email,
            message: message
        });
        
        // Show success view
        document.getElementById('feedback-form').classList.add('hidden');
        document.getElementById('feedback-success').classList.remove('hidden');
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            sendBtn.innerHTML = originalText;
            sendBtn.disabled = false;
            cancelBtn.disabled = false;
            closeFeedbackDialog();
        }, 3000);
        
    } catch (error) {
        alert(`Error: ${error.message}`);
        
        // Restore button state
        sendBtn.innerHTML = originalText;
        sendBtn.disabled = false;
        cancelBtn.disabled = false;
    }
}

// ==================== UI HELPERS ====================
function showLoading(show) {
    const loading = document.getElementById('loading-indicator');
    const results = document.getElementById('review-results');
    
    if (show) {
        loading.classList.remove('hidden');
        results.classList.add('hidden');
    } else {
        loading.classList.add('hidden');
    }
}
