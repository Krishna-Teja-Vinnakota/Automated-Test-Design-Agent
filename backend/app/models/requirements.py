"""MongoDB document models."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class Timestamps(BaseModel):
    """Timestamp fields for requirements document."""
    created: datetime = Field(default_factory=datetime.utcnow)
    specGenerated: Optional[datetime] = None
    specAccepted: Optional[datetime] = None
    scenariosGenerated: Optional[datetime] = None
    scenariosAccepted: Optional[datetime] = None
    developerAssigned: Optional[datetime] = None
    testsGenerated: Optional[datetime] = None
    testsExecuted: Optional[datetime] = None
    reviewed: Optional[datetime] = None


class RequirementDocument(BaseModel):
    """MongoDB document model for requirements."""
    jiraTicketId: str
    jiraData: Dict[str, Any]
    spec: Optional[Dict[str, Any]] = None
    testScenarios: Optional[List[Dict[str, Any]]] = None
    status: str = "draft"  # draft | spec_accepted | scenarios_accepted | tests_generated | tests_executed | reviewed | completed
    testType: Optional[str] = None  # frontend | backend
    assignedDeveloperEmail: Optional[str] = None
    developerFiles: Optional[List[str]] = None
    generatedTestCode: Optional[str] = None
    testResults: Optional[Dict[str, Any]] = None
    reviewDecision: Optional[Dict[str, Any]] = None
    feedback: Optional[Dict[str, Any]] = None
    timestamps: Timestamps = Field(default_factory=Timestamps)
    
    # Epic Context Fields
    ticketType: Optional[str] = "default"  # "default" | "epic"
    epicData: Optional[Dict[str, Any]] = None
    epicTicketId: Optional[str] = None
    siblingTickets: Optional[List[Dict[str, Any]]] = None  # All sibling user stories under the same epic
    
    class Config:
        json_schema_extra = {
            "example": {
                "jiraTicketId": "PROJ-123",
                "jiraData": {},
                "status": "draft"
            }
        }
