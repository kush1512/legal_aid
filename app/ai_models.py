from typing import Any, Literal
from pydantic import BaseModel, Field
from app.schemas import Category, CaseStatus

class ExtractedFact(BaseModel):
    key: str
    value: Any
    source: Literal["user_provided","ai_inference"] = "ai_inference"
    evidence_quote: str | None = None
    confidence: float | None = None
    verified: bool = False

class CaseIntakeResult(BaseModel):
    assistant_reply: str = Field(min_length=1, description="A natural, context-aware assistant response to the latest user message.")
    case_status: CaseStatus = CaseStatus.needs_information
    follow_up_questions: list[str] = Field(default_factory=list)
    extracted_facts: list[ExtractedFact] = Field(default_factory=list)
    user_objective: str | None = None
    unknowns: list[str] = Field(default_factory=list)
    emergency_detected: bool = False
    emergency_reason: str | None = None

class AssessmentContent(BaseModel):
    summary: str = "Assessment could not be completed with the available information."
    parties: list[dict[str,Any]] = Field(default_factory=list)
    timeline: list[dict[str,Any]] = Field(default_factory=list)
    evidence: list[dict[str,Any]] = Field(default_factory=list)
    established_facts: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    unknowns: list[str] = Field(default_factory=list)
    legal_position: str = "No legal position is asserted until relevant law and facts are verified."
    potentially_relevant_laws: list[dict[str,Any]] = Field(default_factory=list)
    options: list[dict[str,Any]] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    overall_uncertainty: Literal["low","medium","high"] = "high"
    confidence: float = Field(default=0, ge=0, le=1)
    escalation_required: bool = False
    escalation_reason: str | None = None
    used_source_ids: list[str] = Field(default_factory=list)

class DraftContent(BaseModel):
    title: str = "Preliminary draft — review required"
    content: str = "[Insert verified facts and obtain professional review before use.]"
    placeholders: list[str] = Field(default_factory=lambda: ["[DATE]","[NAME]","[ADDRESS]"])
    used_source_ids: list[str] = Field(default_factory=list)
