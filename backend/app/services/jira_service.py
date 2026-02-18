"""Jira API integration service."""
import requests
from typing import Dict, Any, Optional, List
from app.config.settings import settings


class JiraService:
    """Service for interacting with Jira API."""
    
    def __init__(self):
        self.base_url = settings.JIRA_BASE_URL
        self.email = settings.JIRA_EMAIL
        self.api_token = settings.JIRA_API_TOKEN
        self.auth = (self.email, self.api_token)
        self.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
    
    def fetch_ticket(self, ticket_id: str) -> Dict[str, Any]:
        """Fetch Jira ticket data."""
        url = f"{self.base_url}/rest/api/3/issue/{ticket_id}"
        
        try:
            response = requests.get(url, auth=self.auth, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to fetch Jira ticket: {str(e)}")
    
    def fetch_epic_for_ticket(self, ticket_id: str) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Fetch parent epic if ticket is a child.
        Returns: (epic_data, epic_ticket_id) or (None, None) if no parent.
        """
        try:
            print(f"\n🔍 [Jira Service] Checking for parent epic of {ticket_id}...")
            
            # Fetch the child ticket
            ticket_data = self.fetch_ticket(ticket_id)
            
            # Check if ticket has a parent
            parent = ticket_data.get('fields', {}).get('parent')
            
            if parent and parent.get('key'):
                epic_id = parent['key']
                print(f"   Found parent field: {epic_id}")
                print(f"   Fetching epic data for {epic_id}...")
                
                # Fetch the parent epic
                epic_data = self.fetch_ticket(epic_id)
                epic_summary = epic_data.get('fields', {}).get('summary', 'N/A')
                
                print(f"   ✅ Epic fetched successfully")
                print(f"      Summary: {epic_summary}")
                
                return epic_data, epic_id
            else:
                print(f"   ℹ️  No parent field found in ticket {ticket_id}")
            
            return None, None
        except Exception as e:
            print(f"   ❌ Error fetching epic for ticket {ticket_id}: {str(e)}")
            return None, None
    
    def fetch_all_epic_children(self, epic_id: str, exclude_ticket_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetch all child tickets of an epic using POST /search/jql endpoint.
        
        Args:
            epic_id: The epic ticket ID (e.g., KAN-270)
            exclude_ticket_id: Optional ticket ID to exclude from results (the current ticket)
        
        Returns:
            List of sibling ticket data dictionaries
        """
        try:
            print(f"\n👥 [Jira Service] Fetching all children of epic {epic_id}...")
            
            # Use POST /search/jql endpoint (newer Jira API)
            url = f"{self.base_url}/rest/api/3/search/jql"
            
            # JQL query to find all tickets with this epic as parent
            jql = f'parent = {epic_id}'
            
            payload = {
                "jql": jql,
                "maxResults": 100,
                "fields": ["summary", "description", "status", "priority", "issuetype", "created", "updated", "assignee"]
            }
            
            print(f"   Using JQL: {jql}")
            print(f"   Endpoint: POST /rest/api/3/search/jql")
            
            response = requests.post(
                url,
                auth=self.auth,
                headers=self.headers,
                json=payload
            )
            
            if response.status_code == 200:
                result = response.json()
                issues = result.get('issues', [])
                
                print(f"   ✅ Query successful! Found {len(issues)} child tickets")
                
                # Filter out the current ticket if specified
                if exclude_ticket_id:
                    issues = [issue for issue in issues if issue.get('key') != exclude_ticket_id]
                    print(f"   Excluding current ticket {exclude_ticket_id}")
                    print(f"   ✅ Total sibling tickets: {len(issues)}")
                
                # Display first few
                for i, issue in enumerate(issues[:5], 1):
                    summary = issue.get('fields', {}).get('summary', 'N/A')[:60]
                    print(f"      {i}. {issue.get('key')}: {summary}...")
                
                if len(issues) > 5:
                    print(f"      ... and {len(issues) - 5} more")
                
                return issues
            else:
                print(f"   ❌ Query failed with status {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return []
            
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Error fetching epic children: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"   Response: {e.response.text[:200]}")
            return []
        except Exception as e:
            print(f"   ❌ Unexpected error: {str(e)}")
            return []
    
    def get_user_by_email(self, email: str) -> Optional[str]:
        """Find Jira user account ID by email."""
        url = f"{self.base_url}/rest/api/3/user/search"
        params = {"query": email}
        
        try:
            response = requests.get(url, auth=self.auth, headers=self.headers, params=params)
            response.raise_for_status()
            users = response.json()
            if users:
                return users[0].get("accountId")
            return None
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to find user by email: {str(e)}")
    
    def assign_ticket(self, ticket_id: str, user_email: str) -> bool:
        """Assign Jira ticket to developer."""
        account_id = self.get_user_by_email(user_email)
        if not account_id:
            raise Exception(f"User with email {user_email} not found in Jira")
        
        url = f"{self.base_url}/rest/api/3/issue/{ticket_id}/assignee"
        data = {"accountId": account_id}
        
        try:
            response = requests.put(url, auth=self.auth, headers=self.headers, json=data)
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to assign ticket: {str(e)}")
    
    def add_comment(self, ticket_id: str, body: str) -> Dict[str, Any]:
        """Add comment to Jira ticket using ADF format."""
        url = f"{self.base_url}/rest/api/3/issue/{ticket_id}/comment"
        
        # Convert plain text to Atlassian Document Format (ADF)
        # For API v3, body must be in ADF format
        adf_body = {
            "body": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": body
                            }
                        ]
                    }
                ]
            }
        }
        
        try:
            response = requests.post(url, auth=self.auth, headers=self.headers, json=adf_body)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to add comment: {str(e)}")
    
    def update_comment(self, ticket_id: str, comment_id: str, body: str) -> Dict[str, Any]:
        """Update comment on Jira ticket."""
        url = f"{self.base_url}/rest/api/3/issue/{ticket_id}/comment/{comment_id}"
        data = {"body": body}
        
        try:
            response = requests.put(url, auth=self.auth, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to update comment: {str(e)}")
    
    def format_requirements_comment(self, jira_data: Dict, spec: Dict, scenarios: List[Dict]) -> str:
        """Format requirements comment for Jira - FULL detailed format."""
        comment = "Testing Requirements Assigned\n\n"
        comment += f"Summary: {jira_data.get('fields', {}).get('summary', 'N/A')}\n\n"
        
        # Add requirements from spec
        requirements = spec.get('requirements', [])
        if requirements:
            comment += "Requirements:\n"
            for req in requirements:
                comment += f"- {req.get('id', '')}: {req.get('description', '')} [Priority: {req.get('priority', 'N/A')}]\n"
            comment += "\n"
        
        # Add acceptance criteria from spec
        acceptance_criteria = spec.get('acceptanceCriteria', [])
        if acceptance_criteria:
            comment += "Acceptance Criteria:\n"
            for ac in acceptance_criteria:
                comment += f"- {ac.get('id', '')}: {ac.get('description', '')}\n"
            comment += "\n"
        
        # Add FULL test scenarios with all details
        comment += f"Test Scenarios ({len(scenarios)} total):\n\n"
        for i, scenario in enumerate(scenarios, 1):
            comment += f"--- {scenario.get('id', f'TC-{i:03d}')} ---\n"
            comment += f"Title: {scenario.get('title', 'N/A')}\n"
            comment += f"Type: {scenario.get('type', 'N/A')} | Priority: {scenario.get('priority', 'N/A')}\n"
            comment += f"Description: {scenario.get('description', 'N/A')}\n"
            
            # Preconditions
            preconditions = scenario.get('preconditions', [])
            if preconditions:
                comment += "Preconditions:\n"
                for pre in preconditions:
                    comment += f"  - {pre}\n"
            
            # Steps
            steps = scenario.get('steps', [])
            if steps:
                comment += "Steps:\n"
                for j, step in enumerate(steps, 1):
                    comment += f"  {j}. {step}\n"
            
            # Expected Result
            comment += f"Expected Result: {scenario.get('expectedResult', 'N/A')}\n\n"
        
        comment += "Please implement according to these requirements."
        return comment
    
    def _extract_text_from_adf(self, adf_content: Any) -> str:
        """Extract plain text from Jira ADF."""
        if not isinstance(adf_content, dict):
            return str(adf_content) if adf_content else ''
        
        text_parts = []
        content = adf_content.get('content', [])
        for item in content:
            if isinstance(item, dict):
                item_content = item.get('content', [])
                for sub_item in item_content:
                    if isinstance(sub_item, dict) and sub_item.get('type') == 'text':
                        text_parts.append(sub_item.get('text', ''))
        return ' '.join(text_parts)
