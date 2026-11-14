"""Typed, domain-neutral contracts for the Copilot request workflow."""
from __future__ import annotations

from enum import Enum
import unicodedata
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EvidenceStatus(str, Enum):
    VERIFIED = "verified"
    INSUFFICIENT = "insufficient"
    NOT_APPLICABLE = "not_applicable"


class ValidationStatus(str, Enum):
    PASSED = "passed"
    FAILED = "failed"
    NOT_REQUIRED = "not_required"
    NOT_RUN = "not_run"


class ClinicalRequestContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    original_query: str = Field(min_length=1)
    normalized_query: str = Field(min_length=1)
    rewritten_query: str | None = None
    history_reference: str | None = None
    user_role: str
    patient_context_reference: str | None = None
    required_entities: list[str] = Field(default_factory=list)


class RouteDecision(BaseModel):
    model_config = ConfigDict(frozen=True)

    intent: str = Field(min_length=1)
    executor_key: str = Field(min_length=1)
    reason_code: str = Field(min_length=1)
    required_entities: list[str] = Field(default_factory=list)
    evidence_required: bool


class EvidenceRecord(BaseModel):
    model_config = ConfigDict(frozen=True)

    evidence_id: str = Field(min_length=1)
    source_id: str = Field(min_length=1)
    source_version: str | None = None
    content: str = Field(min_length=1)
    chunk_id: str | None = None
    section: str | None = None
    retrieval_metadata: dict[str, Any] = Field(default_factory=dict)


class WorkflowTrace(BaseModel):
    model_config = ConfigDict(frozen=True)

    trace_id: str = Field(min_length=1)
    selected_executor: str | None = None
    rewrite_applied: bool = False
    fallback_reason: str | None = None
    validation_status: ValidationStatus = ValidationStatus.NOT_RUN
    timings_ms: dict[str, float] = Field(default_factory=dict)


class ExecutorResult(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    outcome_type: Literal["clinical_factual", "clarification", "conversational", "operational"]
    evidence_status: EvidenceStatus
    validation_status: ValidationStatus
    response: dict[str, Any]
    evidence: list[EvidenceRecord] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    abstention_reason: str | None = None
    trace: WorkflowTrace | None = None

    @model_validator(mode="after")
    def enforce_evidence_contract(self) -> "ExecutorResult":
        if self.outcome_type == "clinical_factual":
            if self.evidence_status == EvidenceStatus.NOT_APPLICABLE:
                raise ValueError("clinical factual results require evidence status")
            if self.evidence_status == EvidenceStatus.VERIFIED:
                if self.validation_status != ValidationStatus.PASSED:
                    raise ValueError("verified clinical result requires passed validation")
                if not self.evidence:
                    raise ValueError("verified clinical result requires evidence records")
                invalid_versions = {"unversioned", "unknown", "none"}
                if any(
                    not item.source_version
                    or not _normalized_version(item.source_version)
                    or _normalized_version(item.source_version) in invalid_versions
                    for item in self.evidence
                ):
                    raise ValueError("verified clinical result requires versioned evidence")
        elif self.evidence_status == EvidenceStatus.VERIFIED:
            raise ValueError("only clinical factual results may use verified evidence status")
        return self


def _normalized_version(value: str) -> str:
    return "".join(
        char.casefold()
        for char in value
        if not char.isspace() and unicodedata.category(char) not in {"Cf", "Cc", "Cs"}
    )
