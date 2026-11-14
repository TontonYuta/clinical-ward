"""Strict loader for externally managed, versioned workflow policy."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


class PolicyProvenance(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    source_id: str = Field(min_length=1)
    source_version: str = Field(min_length=1)


class RoutePolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    intent: str = Field(min_length=1)
    executor_key: str = Field(min_length=1)
    evidence_required: bool


class RoutePrecedence(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    signal: str = Field(min_length=1)
    intent: str = Field(min_length=1)


class WorkflowBudgets(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    max_context_chars: int = Field(gt=0)
    top_k: int = Field(gt=0)


class WorkflowPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    schema_version: int
    policy_version: str = Field(min_length=1)
    provenance: PolicyProvenance
    routes: dict[str, RoutePolicy]
    decision_precedence: list[RoutePrecedence] = Field(default_factory=list)
    budgets: WorkflowBudgets

    @model_validator(mode="after")
    def validate_route_index(self) -> "WorkflowPolicy":
        if not self.routes:
            raise ValueError("routes must contain at least one intent mapping")
        for key, route in self.routes.items():
            if key != route.intent:
                raise ValueError("route map key must equal route intent")
        seen_signals: set[str] = set()
        for precedence in self.decision_precedence:
            if precedence.signal in seen_signals:
                raise ValueError(f"duplicate route precedence signal: {precedence.signal}")
            if precedence.intent not in self.routes:
                raise ValueError(f"route precedence references unmapped intent: {precedence.intent}")
            seen_signals.add(precedence.signal)
        if not self.provenance.source_id.strip() or not self.provenance.source_version.strip():
            raise ValueError("policy provenance must include source_id and source_version")
        return self


def load_workflow_policy(
    path: str | Path, *, registered_executors: set[str]
) -> WorkflowPolicy:
    policy_path = Path(path)
    try:
        raw: Any = json.loads(policy_path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise ValueError("policy document root must be an object")
        if raw.get("schema_version") != 1:
            raise ValueError("unsupported workflow policy schema_version")
        route_rows = raw.get("routes")
        if not isinstance(route_rows, list):
            raise ValueError("routes must be a list")
        route_map: dict[str, dict[str, Any]] = {}
        for route in route_rows:
            if not isinstance(route, dict):
                raise ValueError("each route must be an object")
            intent = route.get("intent")
            if not isinstance(intent, str) or not intent.strip():
                raise ValueError("route intent is required")
            if intent in route_map:
                raise ValueError(f"duplicate route intent: {intent}")
            executor = route.get("executor_key")
            if executor not in registered_executors:
                raise ValueError(f"route references unregistered executor: {executor}")
            route_map[intent] = route
        normalized = {**raw, "routes": route_map}
        return WorkflowPolicy.model_validate(normalized)
    except (OSError, json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
        raise ValueError(f"cannot read valid workflow policy at {policy_path}: {exc}") from exc


def validate_policy_route_coverage(
    policy: WorkflowPolicy, *, required_intents: set[str]
) -> None:
    """Fail closed if any live NLU intent lacks an explicit managed route."""
    missing = sorted(required_intents.difference(policy.routes))
    if missing:
        raise ValueError(
            "workflow policy is missing live route intents: " + ", ".join(missing)
        )
