"""Shared dependencies for API routes."""
from app.config.database import get_database
from app.services.jira_service import JiraService
from app.services.llm_service import LLMService
from app.services.test_executor import TestExecutor
from app.services.file_handler import FileHandler
from app.agents.spec_interpreter import SpecInterpreterAgent
from app.agents.scenario_generator import ScenarioGeneratorAgent
from app.agents.test_code_generator import TestCodeGeneratorAgent
from app.agents.test_reviewer import TestReviewerAgent


def get_jira_service() -> JiraService:
    """Get Jira service instance."""
    return JiraService()


def get_llm_service() -> LLMService:
    """Get LLM service instance."""
    return LLMService()


def get_test_executor() -> TestExecutor:
    """Get test executor instance."""
    return TestExecutor()


def get_file_handler() -> FileHandler:
    """Get file handler instance."""
    return FileHandler()


def get_spec_interpreter() -> SpecInterpreterAgent:
    """Get spec interpreter agent instance."""
    return SpecInterpreterAgent()


def get_scenario_generator() -> ScenarioGeneratorAgent:
    """Get scenario generator agent instance."""
    return ScenarioGeneratorAgent()


def get_test_code_generator() -> TestCodeGeneratorAgent:
    """Get test code generator agent instance."""
    return TestCodeGeneratorAgent()


def get_test_reviewer() -> TestReviewerAgent:
    """Get test reviewer agent instance."""
    return TestReviewerAgent()
