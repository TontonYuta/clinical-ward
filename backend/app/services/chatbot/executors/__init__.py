"""Clean Single-Pass Executor Registry for Clinical Copilot Workflow Orchestration."""
from app.services.chatbot.executors.context import WorkflowExecutionContext
from app.services.chatbot.executors.managed_executors import (
    MANAGED_EXECUTORS,
    dispatch_managed_workflow,
)
from app.services.chatbot.executors.fallback_pipeline import run_fallback_clinical_pipeline

__all__ = [
    "WorkflowExecutionContext",
    "MANAGED_EXECUTORS",
    "dispatch_managed_workflow",
    "run_fallback_clinical_pipeline",
]
