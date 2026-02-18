"""Test Reviewer Agent - reviews test results against requirements."""
import json
from typing import Dict, Any, List
from app.services.llm_service import LLMService


class TestReviewerAgent:
    """Agent that reviews test execution results against requirements."""
    
    def __init__(self):
        self.llm_service = LLMService()
    
    def review_test_results(
        self,
        jira_data: Dict[str, Any],
        spec: Dict[str, Any],
        scenarios: List[Dict[str, Any]],
        test_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Review test results and validate against requirements."""
        prompt = self._build_prompt(jira_data, spec, scenarios, test_results)
        
        system_prompt = """You are a test reviewer. 
        Review test execution results against requirements and determine if all requirements are met.
        Return valid JSON only, no markdown formatting."""
        
        response = self.llm_service.generate_json(prompt, system_prompt)
        return response
    
    def _build_prompt(
        self,
        jira_data: Dict[str, Any],
        spec: Dict[str, Any],
        scenarios: List[Dict[str, Any]],
        test_results: Dict[str, Any]
    ) -> str:
        """Build prompt for test review - OPTIMIZED to reduce token count."""
        summary = jira_data.get('fields', {}).get('summary', '')
        spec_title = spec.get('title', '')
        requirements = spec.get('requirements', [])
        acceptance_criteria = spec.get('acceptanceCriteria', [])
        
        # ✅ FIX: Extract only essential test result data (no console output, no screenshots)
        essential_results = {
            "success": test_results.get("success", False),
            "summary": test_results.get("summary", {}),
            "testResults": []
        }
        
        # Only include test status, name, duration, and error (no console output)
        for test in test_results.get("testResults", []):
            essential_results["testResults"].append({
                "id": test.get("id"),
                "name": test.get("name") or test.get("title"),
                "status": test.get("status"),
                "duration": test.get("duration"),
                "error": test.get("error", {}).get("message") if test.get("error") else None
            })
        
        prompt = f"""Review the test execution results against the Jira requirements, specification, and test scenarios.

Jira Ticket: {summary}
Specification Title: {spec_title}

Requirements:
{json.dumps(requirements, indent=2)}

Acceptance Criteria:
{json.dumps(acceptance_criteria, indent=2)}

Test Scenarios:
{json.dumps(scenarios, indent=2)}

Test Execution Results (Summary):
{json.dumps(essential_results, indent=2)}

Analyze the results and determine:
1. Which test scenarios passed
2. Which test scenarios failed
3. Whether all requirements are met
4. Reasoning for pass/fail decision
5. Recommendations for next steps

Return JSON with the following structure:
{{
  "passed": true|false,
  "reasoning": "Detailed reasoning for the decision",
  "passedScenarios": [
    {{
      "scenarioId": "TC-001",
      "name": "Scenario name",
      "status": "passed"
    }}
  ],
  "failedScenarios": [
    {{
      "scenarioId": "TC-002",
      "name": "Scenario name",
      "status": "failed",
      "error": "Error message",
      "suggestion": "Suggestion for fixing"
    }}
  ],
  "requirementsMet": true|false,
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}}

Return only valid JSON."""
        return prompt
