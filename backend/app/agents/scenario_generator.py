"""Scenario Generator Agent - generates test scenarios from Epic + Jira + Spec."""
import json
from typing import Dict, Any, List, Optional
from app.services.llm_service import LLMService


class ScenarioGeneratorAgent:
    """Agent that generates test scenarios from Jira data, specification, and optional epic context."""
    
    def __init__(self):
        self.llm_service = LLMService()
    
    def generate_scenarios(self, jira_data: Dict[str, Any], spec: Dict[str, Any], epic_data: Optional[Dict[str, Any]] = None, sibling_tickets: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        """Generate test scenarios from Jira data, spec, optional epic context and sibling tickets."""
        print(f"\n🤖 [Scenario Generator Agent]")
        print(f"   Epic context received: {epic_data is not None}")
        if epic_data:
            epic_id = epic_data.get('key', 'Unknown')
            print(f"   Epic ID: {epic_id}")
        print(f"   Sibling tickets received: {len(sibling_tickets) if sibling_tickets else 0}")
        
        prompt = self._build_prompt(jira_data, spec, epic_data, sibling_tickets)
        
        system_prompt = """You are a highly experienced QA engineer and test scenario architect.
Your PRIMARY GOAL is to think deeply and creatively to generate comprehensive test scenarios that go BEYOND the obvious acceptance criteria.

CRITICAL MINDSET:
- Think like a QA trying to BREAK the system
- Imagine what developers might overlook
- Consider real-world user behaviors and edge cases
- Use the epic and sibling stories to identify integration issues
- Generate scenarios that would have HIGH VALUE for finding bugs

Generate scenarios covering:
1. **Positive scenarios** - Happy paths (basic coverage)
2. **Negative scenarios** - Error handling, invalid inputs, unauthorized access
3. **Edge cases** - Boundary values, empty states, maximum limits, timing issues
4. **Integration scenarios** - How this feature interacts with related features from sibling stories
5. **Regression scenarios** - What could break in existing functionality
6. **Security scenarios** - Authorization, data exposure, injection attacks
7. **Performance scenarios** - Large data sets, concurrent users, timeout handling
8. **Data integrity scenarios** - Consistency across operations, rollback scenarios

QUANTITY: Aim for 15-30 scenarios depending on complexity. Quality over quantity, but be thorough.

Return ONLY a valid JSON array, no markdown, no code blocks."""
        
        context_type = "standard"
        if epic_data and sibling_tickets:
            context_type = "epic + siblings"
        elif epic_data:
            context_type = "epic-aware"
        
        print(f"   Calling LLM with '{context_type}' prompt...")
        response = self.llm_service.generate_json(prompt, system_prompt)
        
        # Ensure response is a list
        if isinstance(response, dict):
            if 'scenarios' in response:
                result = response['scenarios']
            elif 'testScenarios' in response:
                result = response['testScenarios']
            elif 'content' in response:
                # Try to parse content as JSON
                try:
                    content = response['content']
                    if isinstance(content, str):
                        import re
                        # Try to extract JSON array from content
                        array_match = re.search(r'\[.*\]', content, re.DOTALL)
                        if array_match:
                            parsed = json.loads(array_match.group(0))
                            if isinstance(parsed, list):
                                result = parsed
                            else:
                                result = [response]
                        else:
                            result = [response]
                    else:
                        result = [response]
                except:
                    result = [response]
            else:
                result = [response]
        elif isinstance(response, list):
            result = response
        else:
            result = []
        
        print(f"   ✅ Generated {len(result)} scenarios")
        return result
    
    def _build_prompt(self, jira_data: Dict[str, Any], spec: Dict[str, Any], epic_data: Optional[Dict[str, Any]] = None, sibling_tickets: Optional[List[Dict[str, Any]]] = None) -> str:
        """Build prompt from Jira data, spec, optional epic context and sibling tickets."""
        
        # Build epic context if available
        epic_context = ""
        if epic_data:
            epic_summary = epic_data.get('fields', {}).get('summary', '')
            epic_description = epic_data.get('fields', {}).get('description', {})
            epic_desc_text = self._extract_text_from_adf(epic_description) if isinstance(epic_description, dict) else str(epic_description or '')
            
            epic_context = f"""
=== EPIC CONTEXT (Strategic Goal) ===
Epic: {epic_data.get('key', 'N/A')} - {epic_summary}
Description: {epic_desc_text}

Use this epic context to understand the broader business goal when creating test scenarios.

"""
        
        # Build sibling tickets context if available
        siblings_context = ""
        if sibling_tickets and len(sibling_tickets) > 0:
            siblings_context = "\n=== RELATED USER STORIES (Context from Sibling Tickets) ===\n"
            siblings_context += f"Total sibling stories: {len(sibling_tickets)}\n"
            siblings_context += "These user stories are being developed alongside the current ticket. Use them to:\n"
            siblings_context += "- Understand related functionality that may need integration testing\n"
            siblings_context += "- Avoid testing scenarios already covered by other stories\n"
            siblings_context += "- Ensure test scenarios align with the overall epic scope\n\n"
            
            for i, sibling in enumerate(sibling_tickets[:8], 1):  # Limit to 8 for scenarios
                sibling_key = sibling.get('key', 'N/A')
                sibling_summary = sibling.get('fields', {}).get('summary', 'N/A')
                
                siblings_context += f"{i}. {sibling_key}: {sibling_summary}\n"
            
            if len(sibling_tickets) > 8:
                siblings_context += f"... and {len(sibling_tickets) - 8} more sibling tickets\n\n"
            else:
                siblings_context += "\n"
        
        # Get ticket details
        summary = jira_data.get('fields', {}).get('summary', '')
        description = jira_data.get('fields', {}).get('description', {})
        
        # Extract description text if it's in ADF format
        if isinstance(description, dict) and 'content' in description:
            desc_text = self._extract_text_from_adf(description)
        else:
            desc_text = str(description) if description else ''
        
        spec_title = spec.get('title', '')
        acceptance_criteria = spec.get('acceptanceCriteria', [])
        
        # Count acceptance criteria to guide scenario count
        ac_count = len(acceptance_criteria)
        
        prompt = f"""{epic_context}{siblings_context}Generate test scenarios for this requirement.

JIRA TICKET:
- Summary: {summary}
- Description: {desc_text}

SPECIFICATION:
- Title: {spec_title}
- Acceptance Criteria: {json.dumps(acceptance_criteria, indent=2)}

RULES FOR SCENARIO GENERATION:
1. **Start with AC Coverage**: Ensure each acceptance criterion has at least ONE scenario
2. **Expand Creatively**: Generate 3-5x MORE scenarios than acceptance criteria by thinking about:
   - What could go wrong? (negative cases)
   - What are the boundaries? (edge cases)  
   - What happens under load/stress? (performance)
   - How does this interact with sibling features? (integration)
   - What would a malicious user try? (security)
   - What data states could cause issues? (data integrity)

3. **Use Sibling Context**: Look at the related user stories and ask:
   - Could changes in one story break this story?
   - Are there shared components that need integration testing?
   - Could race conditions occur between features?
   - Are there conflicting business rules?

4. **Think Like a Developer**: What shortcuts might a developer take? What validations might they forget?

5. **Real-World Scenarios**: Consider actual user behavior, not just ideal flows

EXPECTED OUTPUT: 
- Minimum: {ac_count} scenarios (one per AC)
- Target: {ac_count * 4} to {ac_count * 6} scenarios
- Include diverse scenario types (Positive, Negative, Edge, Integration, Security, Performance)

SCENARIO PRIORITIZATION:
- High: Core functionality, security, data integrity
- Medium: Edge cases, integration scenarios
- Low: Nice-to-have validations, UI polish

Return ONLY a JSON array with this structure:
[
  {{
    "id": "TC-001",
    "title": "Short descriptive title",
    "type": "Positive|Negative|Edge|Integration|Security|Performance",
    "priority": "High|Medium|Low",
    "description": "Detailed description explaining WHAT this tests and WHY it matters",
    "preconditions": ["User is logged in", "User is on profile page"],
    "steps": ["Step 1", "Step 2", "Step 3"],
    "expectedResult": "Specific expected outcome with measurable criteria",
    "testData": {{
      "inputValue": "example data if needed",
      "expectedOutput": "expected result"
    }}
  }}
]

CREATIVE THINKING EXAMPLES for your reference:
- Negative: What if user applies discount code AFTER another discount? During checkout vs before?
- Edge: What if customization price is £0? What if discount is 100%? What if item price changes mid-checkout?
- Integration: Based on sibling stories, what if staff discount conflicts with promotional discounts? What about returns?
- Security: Can non-staff users guess/reuse staff codes? Can they manipulate prices via browser tools?
- Data: What if customization SKU is deleted during order? What if discount rules change mid-transaction?
- Performance: What if 1000 staff members checkout simultaneously? Does discount calculation timeout?

Return ONLY the JSON array, starting with [ and ending with ]."""
        return prompt
    
    def _extract_text_from_adf(self, adf: Dict) -> str:
        """Extract plain text from Atlassian Document Format."""
        text_parts = []
        
        def extract_from_content(content):
            if not content:
                return
            for item in content:
                if item.get('type') == 'text':
                    text_parts.append(item.get('text', ''))
                elif item.get('type') == 'hardBreak':
                    text_parts.append('\n')
                elif item.get('type') == 'listItem':
                    text_parts.append('• ')
                if 'content' in item:
                    extract_from_content(item['content'])
                if item.get('type') in ['paragraph', 'listItem']:
                    text_parts.append('\n')
        
        if 'content' in adf:
            extract_from_content(adf['content'])
        
        return ''.join(text_parts)
