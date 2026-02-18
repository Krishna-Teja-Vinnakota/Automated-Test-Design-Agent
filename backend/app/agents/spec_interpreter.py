"""Spec Interpreter Agent - generates spec from Jira data with optional epic context."""
import json
from typing import Dict, Any, Optional, List
from app.services.llm_service import LLMService


class SpecInterpreterAgent:
    """Agent that interprets Jira tickets and generates specifications."""
    
    def __init__(self):
        self.llm_service = LLMService()
    
    def generate_spec(self, jira_data: Dict[str, Any], epic_data: Optional[Dict[str, Any]] = None, sibling_tickets: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Generate specification from Jira ticket data with optional epic context and sibling tickets."""
        print(f"\n🤖 [Spec Interpreter Agent]")
        print(f"   Epic context received: {epic_data is not None}")
        if epic_data:
            epic_id = epic_data.get('key', 'Unknown')
            print(f"   Epic ID: {epic_id}")
        print(f"   Sibling tickets received: {len(sibling_tickets) if sibling_tickets else 0}")
        
        prompt = self._build_prompt(jira_data, epic_data, sibling_tickets)
        
        system_prompt = """You are a precise technical specification interpreter and requirements analyst.

Your PRIMARY GOALS:
1. Extract EVERY requirement from the Jira ticket with 100% accuracy
2. Expand on implicit requirements that developers need to consider
3. Think about edge cases and error scenarios that aren't explicitly mentioned

CRITICAL RULES:
- DO NOT add features that are not mentioned
- DO add validation rules, error handling, and edge cases that are IMPLIED
- Use epic context to understand strategic alignment
- Use sibling stories to identify shared components and potential conflicts
- Think like a developer: what else needs to be considered for production-ready code?

WHAT TO EXTRACT:
1. **Explicit Requirements**: Everything directly stated in the ticket
2. **Implied Requirements**: Error handling, validation, edge cases, rollback scenarios
3. **Non-functional Requirements**: Performance, security, accessibility if relevant
4. **Integration Requirements**: How this interacts with existing features (from sibling context)

Return valid JSON only, no markdown formatting."""
        
        context_type = "standard"
        if epic_data and sibling_tickets:
            context_type = "epic + siblings"
        elif epic_data:
            context_type = "epic-aware"
        
        print(f"   Calling LLM with '{context_type}' prompt...")
        response = self.llm_service.generate_json(prompt, system_prompt)
        print(f"   ✅ Spec generated")
        return response
    
    def _build_prompt(self, jira_data: Dict[str, Any], epic_data: Optional[Dict[str, Any]] = None, sibling_tickets: Optional[List[Dict[str, Any]]] = None) -> str:
        """Build prompt from Jira data with optional epic context and sibling tickets."""
        
        # Build epic context section if available
        epic_context = ""
        if epic_data:
            epic_summary = epic_data.get('fields', {}).get('summary', '')
            epic_description = epic_data.get('fields', {}).get('description', {})
            epic_desc_text = self._extract_text_from_adf(epic_description)
            
            epic_context = f"""
=== EPIC CONTEXT (Strategic Business Goal) ===
Epic ID: {epic_data.get('key', 'N/A')}
Epic Summary: {epic_summary}
Epic Description: {epic_desc_text}

This epic provides the high-level business context and strategic goals.
Use this to understand WHY this feature is being built and ensure the specification aligns with the broader objective.

"""
        
        # Build sibling tickets context if available
        siblings_context = ""
        if sibling_tickets and len(sibling_tickets) > 0:
            siblings_context = "\n=== RELATED USER STORIES (Sibling Tickets in Same Epic) ===\n"
            siblings_context += f"Total sibling stories: {len(sibling_tickets)}\n"
            siblings_context += "These are other user stories being developed under the same epic. Use them to:\n"
            siblings_context += "- Understand the broader feature set being built\n"
            siblings_context += "- Avoid duplicating functionality already covered in other stories\n"
            siblings_context += "- Ensure consistency in terminology and approach\n\n"
            
            for i, sibling in enumerate(sibling_tickets[:10], 1):  # Limit to first 10 to avoid token overflow
                sibling_key = sibling.get('key', 'N/A')
                sibling_summary = sibling.get('fields', {}).get('summary', 'N/A')
                sibling_desc = sibling.get('fields', {}).get('description', {})
                sibling_desc_text = self._extract_text_from_adf(sibling_desc) if isinstance(sibling_desc, dict) else str(sibling_desc or '')
                
                # Truncate description if too long
                if len(sibling_desc_text) > 200:
                    sibling_desc_text = sibling_desc_text[:200] + "..."
                
                siblings_context += f"{i}. {sibling_key}: {sibling_summary}\n"
                if sibling_desc_text:
                    siblings_context += f"   Description: {sibling_desc_text}\n"
                siblings_context += "\n"
            
            if len(sibling_tickets) > 10:
                siblings_context += f"... and {len(sibling_tickets) - 10} more sibling tickets\n\n"
            else:
                siblings_context += "\n"
        
        # Get ticket details
        summary = jira_data.get('fields', {}).get('summary', '')
        description = jira_data.get('fields', {}).get('description', {})
        
        # Extract text from description (Jira uses ADF format)
        desc_text = self._extract_text_from_adf(description)
        
        prompt = f"""{epic_context}{siblings_context}=== CURRENT TICKET (Specific Implementation) ===
Ticket ID: {jira_data.get('key', 'N/A')}
Summary: {summary}
Description: {desc_text}

Analyze the {"epic context, sibling stories, and " if (epic_data or sibling_tickets) else ""}following Jira ticket and generate a COMPREHENSIVE specification document.

CRITICAL RULES:
1. Extract EVERY acceptance criterion mentioned in the ticket - do not miss any
2. For each validation rule, create SPECIFIC acceptance criteria with EXACT values
3. Add IMPLIED acceptance criteria for:
   - Error handling (what happens when things go wrong?)
   - Edge cases (boundary values, empty states, null values)
   - Security concerns (authorization, data validation)
   - Performance expectations (if relevant)
   - Data integrity (rollback, consistency)
4. DO NOT add new features, but DO add necessary validations and error scenarios
5. Use sibling context to identify integration points and potential conflicts
6. Keep it production-ready - think about what developers actually need to implement

Jira Ticket:
- Summary: {summary}
- Description: {desc_text}

Generate a specification with this structure:
{{
  "title": "Feature title from summary",
  "requirements": [
    {{
      "id": "REQ-1",
      "description": "High-level requirement (group related acceptance criteria)",
      "priority": "High|Medium|Low"
    }}
  ],
  "acceptanceCriteria": [
    {{
      "id": "AC-1",
      "description": "SPECIFIC testable criterion with EXACT values from ticket",
      "requirementId": "REQ-1"
    }}
  ],
  "testableFeatures": [
    {{
      "id": "TF-1",
      "name": "Feature name",
      "description": "What to test",
      "requirements": ["REQ-1"]
    }}
  ]
}}

EXAMPLE - If ticket says "Name must be at least 3 characters":
- AC: "Given user enters Name, when Name has fewer than 3 characters, then show validation error 'Name must be at least 3 characters' and disable Save button"

Return ONLY valid JSON, no markdown."""
        return prompt
    
    def _extract_text_from_adf(self, adf_content: Any) -> str:
        """Extract plain text from Jira ADF (Atlassian Document Format)."""
        if isinstance(adf_content, dict):
            text_parts = []
            self._extract_text_recursive(adf_content, text_parts)
            return '\n'.join(text_parts)
        elif isinstance(adf_content, str):
            return adf_content
        return ""
    
    def _extract_text_recursive(self, node: Any, text_parts: list) -> None:
        """Recursively extract text from ADF nodes."""
        if not isinstance(node, dict):
            return
        
        # Handle text nodes
        if node.get('type') == 'text':
            text = node.get('text', '')
            if text:
                text_parts.append(text)
            return
        
        # Handle list items
        if node.get('type') == 'listItem':
            text_parts.append('• ')
        
        # Handle hard breaks
        if node.get('type') == 'hardBreak':
            text_parts.append('\n')
            return
        
        # Recurse into content
        content = node.get('content', [])
        for item in content:
            self._extract_text_recursive(item, text_parts)
        
        # Add newline after paragraphs and list items
        if node.get('type') in ['paragraph', 'listItem', 'heading']:
            text_parts.append('\n')
