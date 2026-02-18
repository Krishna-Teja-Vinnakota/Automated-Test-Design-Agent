"""Pydantic schemas for API requests and responses."""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# Jira Schemas
class JiraTicketResponse(BaseModel):
    """Jira ticket fetch response."""
    success: bool
    jiraData: Dict[str, Any]
    jiraTicketId: str


# Spec Schemas
class SpecGenerateRequest(BaseModel):
    """Request to generate spec."""
    jiraTicketId: str


class SpecModifyRequest(BaseModel):
    """Request to modify spec."""
    jiraTicketId: str
    userPrompt: str


class SpecEditRequest(BaseModel):
    """Request to save edited spec."""
    jiraTicketId: str
    editedSpec: Dict[str, Any]


class SpecAcceptRequest(BaseModel):
    """Request to accept spec."""
    jiraTicketId: str


class SpecResponse(BaseModel):
    """Spec generation response."""
    success: bool
    spec: Dict[str, Any]
    jiraTicketId: str


# Scenario Schemas
class ScenarioGenerateRequest(BaseModel):
    """Request to generate scenarios."""
    jiraTicketId: str


class ScenarioModifyRequest(BaseModel):
    """Request to modify scenarios."""
    jiraTicketId: str
    userPrompt: str


class ScenarioEditRequest(BaseModel):
    """Request to save edited scenarios."""
    jiraTicketId: str
    editedScenarios: List[Dict[str, Any]]


class ScenarioAcceptRequest(BaseModel):
    """Request to accept scenarios."""
    jiraTicketId: str


class ScenarioNotifyRequest(BaseModel):
    """Request to notify developer."""
    jiraTicketId: str
    developerEmail: str


class ScenarioResponse(BaseModel):
    """Scenario generation response."""
    success: bool
    scenarios: List[Dict[str, Any]]
    jiraTicketId: str


# Test Schemas
class TestGenerateRequest(BaseModel):
    """Request to generate test code."""
    jiraTicketId: str
    type: str  # frontend | backend
    framework: Optional[str] = None  # playwright | cypress | jest
    testCategories: Optional[List[str]] = None  # unit | integration (for backend)


class TestExecuteRequest(BaseModel):
    """Request to execute tests."""
    jiraTicketId: str
    targetUrl: Optional[str] = None  # URL of the app to test (e.g., http://localhost:5173)


class TestReviewRequest(BaseModel):
    """Request to review test results."""
    jiraTicketId: str


class TestResponse(BaseModel):
    """Test generation response."""
    success: bool
    testCode: str
    framework: str
    testType: str
    fileName: str


class TestExecutionResponse(BaseModel):
    """Test execution response."""
    success: bool
    results: Dict[str, Any]
    jiraTicketId: str


class TestReviewResponse(BaseModel):
    """Test review response."""
    success: bool
    passed: bool
    reasoning: str
    failedScenarios: List[Dict[str, Any]]
    passedScenarios: List[Dict[str, Any]]
    recommendations: Optional[List[str]] = []
    passedCount: Optional[int] = 0
    failedCount: Optional[int] = 0
    totalCount: Optional[int] = 0


# Developer Feedback Schema
class DeveloperFeedbackRequest(BaseModel):
    """Request to generate developer feedback."""
    jiraTicketId: str
    developerEmail: Optional[str] = None
    message: Optional[str] = None


class DeveloperFeedbackResponse(BaseModel):
    """Developer feedback response."""
    success: bool
    message: str
    feedback: Dict[str, Any]
