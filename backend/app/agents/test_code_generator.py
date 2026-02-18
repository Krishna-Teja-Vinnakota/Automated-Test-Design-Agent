"""Test Code Generator Agent - generates test code from Jira + Spec + Scenarios + Dev Code."""
import json
from typing import Dict, Any, List
from app.services.llm_service import LLMService


class TestCodeGeneratorAgent:
    """Agent that generates test code from requirements, spec, scenarios, and developer code."""
    
    def __init__(self):
        self.llm_service = LLMService()
    
    def generate_test_code(
        self,
        jira_data: Dict[str, Any],
        spec: Dict[str, Any],
        scenarios: List[Dict[str, Any]],
        developer_code: str,
        test_type: str,  # frontend | backend
        framework: str = None,  # playwright | cypress | jest
        test_categories: List[str] = None  # unit | integration (for backend)
    ) -> str:
        """Generate test code for frontend (Playwright/Cypress) or backend (Jest)."""
        
        # Set default framework based on test type
        if framework is None:
            framework = "playwright" if test_type == "frontend" else "jest"
        
        # Set default test categories for backend
        if test_categories is None and test_type == "backend":
            test_categories = ["integration"]
        
        prompt = self._build_prompt(jira_data, spec, scenarios, developer_code, test_type, framework, test_categories)
        
        if test_type == "frontend":
            if framework == "cypress":
                system_prompt = """You are a test code generator specializing in Cypress E2E tests.
                Generate complete, runnable Cypress test code in JavaScript following best practices.
                Return only the test code, no explanations or markdown formatting.
                DO NOT include markdown code fences like ```javascript or ```. Return raw code only."""
            else:  # playwright
                system_prompt = """You are a test code generator specializing in Playwright E2E tests.
                Generate complete, runnable Playwright test code in TypeScript following best practices.
                Return only the test code, no explanations or markdown formatting.
                DO NOT include markdown code fences like ```typescript or ```. Return raw code only."""
        else:  # backend with Jest
            system_prompt = """You are a test code generator specializing in Jest tests for Node.js.
            Generate complete, runnable Jest test code in JavaScript/TypeScript following best practices.
            Return only the test code, no explanations or markdown formatting.
            DO NOT include markdown code fences like ```javascript or ```. Return raw code only."""
        
        response = self.llm_service.generate(prompt, system_prompt)
        
        # Strip markdown code fences if present
        response = self._strip_code_fences(response)
        
        return response
    
    def _strip_code_fences(self, code: str) -> str:
        """Remove markdown code fences from generated code."""
        import re
        
        # Remove opening code fence with optional language identifier
        # Matches: ```typescript, ```javascript, ```ts, ```js, ``` etc.
        code = re.sub(r'^```(?:typescript|javascript|ts|js|python|py)?\s*\n?', '', code, flags=re.MULTILINE)
        
        # Remove closing code fence
        code = re.sub(r'\n?```\s*$', '', code, flags=re.MULTILINE)
        
        # Also handle case where ``` appears at the start of a line in the middle
        code = re.sub(r'\n```(?:typescript|javascript|ts|js|python|py)?\s*\n', '\n', code)
        code = re.sub(r'\n```\s*\n', '\n', code)
        
        return code.strip()
    
    def _build_prompt(
        self,
        jira_data: Dict[str, Any],
        spec: Dict[str, Any],
        scenarios: List[Dict[str, Any]],
        developer_code: str,
        test_type: str,
        framework: str,
        test_categories: List[str] = None
    ) -> str:
        """Build prompt for test code generation."""
        summary = jira_data.get('fields', {}).get('summary', '')
        description = jira_data.get('fields', {}).get('description', {})
        spec_title = spec.get('title', '')
        requirements = spec.get('requirements', [])
        acceptance_criteria = spec.get('acceptanceCriteria', [])
        
        # Get framework-specific info
        framework_info = self._get_framework_info(test_type, framework, test_categories)
        
        prompt = f"""Generate comprehensive test code for {test_type} application using {framework}.

=== JIRA TICKET CONTEXT ===
Summary: {summary}
Description: {description}

=== SPECIFICATION ===
Title: {spec_title}
Requirements: {json.dumps(requirements, indent=2)}
Acceptance Criteria: {json.dumps(acceptance_criteria, indent=2)}

=== TEST SCENARIOS TO IMPLEMENT ===
{json.dumps(scenarios, indent=2)}

=== DEVELOPER CODE (for reference) ===
{developer_code if developer_code else "No developer code provided"}

{framework_info}

REQUIREMENTS:
1. Generate complete, runnable test code
2. Cover ALL test scenarios provided above
3. Use descriptive test names matching scenario IDs (e.g., test_tc_001_...)
4. Include proper setup and teardown
5. Add comments explaining each test
6. Follow best practices for {framework} testing
7. Make tests independent and idempotent
8. Handle edge cases and error scenarios

Return ONLY the test code, ready to execute without modification."""
        
        return prompt
    
    def _get_framework_info(self, test_type: str, framework: str, test_categories: List[str] = None) -> str:
        """Get framework-specific information for the prompt."""
        
        if test_type == "frontend":
            if framework == "cypress":
                return """
FRAMEWORK: Cypress with JavaScript
- Use cy.visit(), cy.get(), cy.click(), cy.type() etc.
- Use cy.should() for assertions
- Include proper describe() and it() blocks
- Add beforeEach/afterEach hooks for setup/teardown
- Use data-testid or data-cy selectors when available
- Handle async operations with Cypress's built-in waiting

Example structure:
```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('TC-001: Test scenario title', () => {
    // Test implementation
    cy.get('[data-testid="element"]').should('be.visible');
    cy.get('[data-testid="button"]').click();
    cy.get('[data-testid="result"]').should('contain', 'expected text');
  });
});
```"""
            else:  # playwright
                return """
FRAMEWORK: Playwright with TypeScript
- Use @playwright/test for E2E testing
- Use page.goto(), page.click(), page.fill(), page.locator() etc.
- Use expect() for assertions
- Include proper test.describe() and test() blocks
- Add beforeEach/afterEach hooks for setup/teardown
- Use data-testid selectors when available
- Handle async operations properly with await

Example structure:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC-001: Test scenario title', async ({ page }) => {
    // Test implementation
    await expect(page.locator('[data-testid="element"]')).toBeVisible();
    await page.click('[data-testid="button"]');
    await expect(page.locator('[data-testid="result"]')).toContainText('expected text');
  });
});
```"""
        
        else:  # backend with Jest
            categories_str = ", ".join(test_categories) if test_categories else "integration"
            
            unit_example = ""
            integration_example = ""
            
            if test_categories and "unit" in test_categories:
                unit_example = """
// Unit Test Example
describe('validateEmail', () => {
  it('should return true for valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });

  it('should return false for invalid email', () => {
    expect(validateEmail('invalid-email')).toBe(false);
  });
});
"""
            
            if test_categories and "integration" in test_categories:
                integration_example = """
// Integration/API Test Example (Testing LIVE Backend)
const axios = require('axios');

// NOTE: These tests hit the ACTUAL running backend server
const BASE_URL = process.env.TARGET_URL || 'http://localhost:3001';

describe('User Profile API', () => {
  describe('PUT /api/profile', () => {
    it('TC-001: should return 400 for invalid name (too short)', async () => {
      const response = await axios.put(`${BASE_URL}/api/profile`, {
        name: 'Jo',  // Invalid: < 3 chars
        email: 'valid@example.com',
        phone: '1234567890',
        age: 25
      }, { validateStatus: () => true });  // Accept any status code
      
      expect(response.status).toBe(400);
      expect(response.data.errors).toBeDefined();
    });

    it('TC-002: should return 200 for valid profile data', async () => {
      const response = await axios.put(`${BASE_URL}/api/profile`, {
        name: 'Valid Name',
        email: 'valid@example.com',
        phone: '1234567890',
        age: 25,
        bio: 'A short bio'
      }, { validateStatus: () => true });
      
      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Profile updated successfully');
    });
  });
});
"""
            
            return f"""
FRAMEWORK: Jest with Node.js (Test Categories: {categories_str})
- Use Jest for testing Node.js backend
- Use axios for HTTP/API testing (NOT supertest with mocked app)
- Test the ACTUAL RUNNING backend server (use TARGET_URL from environment or default to http://localhost:3001)
- DO NOT mock the Express app or create a test server
- DO NOT use require('../app') or import the app
- Use describe() and it()/test() blocks
- Use beforeAll/afterAll for one-time setup/teardown
- Use beforeEach/afterEach for per-test setup/teardown
- Use expect() for assertions

CRITICAL: Your tests MUST hit the real backend API endpoints, not a mocked server!

{unit_example}
{integration_example}

Key Jest Matchers:
- expect(value).toBe(expected) - strict equality
- expect(value).toEqual(expected) - deep equality
- expect(value).toBeTruthy() / toBeFalsy()
- expect(value).toHaveProperty(key)
- expect(value).toContain(item)
- expect(fn).toThrow(error)
- expect(value).toBeNull() / toBeDefined() / toBeUndefined()

For API Testing with axios:
- const BASE_URL = process.env.TARGET_URL || 'http://localhost:3001'
- axios.get(`${{BASE_URL}}/path`) - GET request
- axios.post(`${{BASE_URL}}/path`, body) - POST with body
- axios.put(`${{BASE_URL}}/path`, body) - PUT with body
- {{validateStatus: () => true}} - Accept any HTTP status (for testing error responses)
- response.status - Response status code
- response.data - Response body
"""
