from datetime import date, datetime
from enum import Enum
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

class Category(str, Enum):
    property_real_estate = "property_real_estate"
    marriage_family = "marriage_family"
    digital_fraud_cybercrime = "digital_fraud_cybercrime"
    personal_safety_privacy = "personal_safety_privacy"

class CaseStatus(str, Enum):
    intake = "intake"
    needs_information = "needs_information"
    analysed = "analysed"
    closed = "closed"

class Jurisdiction(BaseModel):
    country: str = "IN"
    state: str | None = None
    district: str | None = None
    city: str | None = None

class CaseCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=180)
    category: Category
    description: str = Field(min_length=5, max_length=12000)
    jurisdiction: Jurisdiction = Field(default_factory=Jurisdiction)
    preferred_language: str = Field(default="en", max_length=20)
    synthetic_demo: bool = False

class MessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=12000)
    language: str = Field(default="en", max_length=20)
    input_mode: Literal["text", "voice_transcription"] = "text"
    external_ai_consent: bool = False

class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    category: Category
    status: CaseStatus
    jurisdiction: dict[str, Any]
    preferred_language: str
    sensitive: bool
    created_at: datetime
    updated_at: datetime
    latest_message_at: datetime | None = None

class MessageOut(BaseModel):
    id: UUID
    case_id: UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    ai_metadata: dict[str, Any] | None = None

class CaseCreateResponse(BaseModel):
    case: CaseOut
    initial_message: MessageOut

class CaseListResponse(BaseModel):
    items: list[CaseOut]
    page: dict[str, int | bool]

class FactOut(BaseModel):
    key: str
    value: Any
    source: Literal["user_provided", "document", "ai_inference"]
    confidence: float | None = None
    verified: bool = False

class MessageCreateResponse(BaseModel):
    user_message: MessageOut
    assistant_message: MessageOut
    case_status: CaseStatus
    follow_up_questions: list[str] = []
    extracted_facts: list[FactOut] = []
    ai: dict[str, Any]

class CitationOut(BaseModel):
    id: UUID
    legal_document_id: UUID
    act_name: str
    section_label: str | None = None
    title: str | None = None
    source_url: str
    source_status: Literal["verified", "unverified", "historical", "superseded"]
    effective_from: date | None = None
    effective_to: date | None = None
    excerpt: str


class AssessmentGenerateRequest(BaseModel):
    external_ai_consent: bool = False

class AssessmentOut(BaseModel):
    id: UUID
    case_id: UUID
    generated_at: datetime
    summary: str
    parties: list[dict[str, Any]] = []
    timeline: list[dict[str, Any]] = []
    evidence: list[dict[str, Any]] = []
    established_facts: list[str] = []
    assumptions: list[str] = []
    unknowns: list[str] = []
    legal_position: str
    potentially_relevant_laws: list[dict[str, Any]] = []
    options: list[dict[str, Any]] = []
    follow_up_questions: list[str] = []
    overall_uncertainty: Literal["low", "medium", "high"] = "high"
    confidence: float = Field(ge=0, le=1, default=0)
    escalation_required: bool = False
    escalation_reason: str | None = None
    disclaimer: str
    model: dict[str, Any]

class LegalSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
    category: Category | None = None
    jurisdiction: Jurisdiction = Field(default_factory=Jurisdiction)
    language: str = "en"
    limit: int = Field(default=10, ge=1, le=30)

class LegalSearchItem(BaseModel):
    citation: CitationOut
    relevance_score: float
    retrieval_method: Literal["hybrid", "keyword", "semantic"]

class LegalSearchResponse(BaseModel):
    results: list[LegalSearchItem]
    warning: str

class DocumentGenerateRequest(BaseModel):
    document_type: Literal["legal_notice", "complaint", "reply", "application", "incident_summary", "evidence_checklist"]
    case_id: UUID | None = None
    instructions: str = Field(default="", max_length=4000)
    language: str = "en"
    facts: dict[str, Any] | None = None
    synthetic_demo: bool = False
    external_ai_consent: bool = False

class DraftOut(BaseModel):
    id: UUID
    case_id: UUID | None
    document_type: str
    title: str
    content: str
    placeholders: list[str]
    citations: list[CitationOut]
    review_required: Literal[True] = True
    created_at: datetime
    model: dict[str, Any]

class CommunityPostCreateRequest(BaseModel):
    title: str = Field(min_length=5, max_length=180)
    content: str = Field(min_length=10, max_length=6000)
    category: Category
    anonymous: bool = False

class CommunityPostOut(BaseModel):
    id: UUID
    title: str
    content: str
    category: Category
    display_name: str
    anonymous: bool
    created_at: datetime
    comment_count: int = 0
    vote_count: int = 0

class LawyerOut(BaseModel):
    id: UUID
    display_name: str
    bar_council_enrolment: str | None = None
    jurisdictions: list[str] = []
    practice_areas: list[Category] = []
    languages: list[str] = []
    verification_status: Literal["pending", "verified", "rejected"]
    bio: str | None = None
    city: str | None = None
    state: str | None = None

class ErrorDetail(BaseModel):
    field: str | None = None
    issue: str

class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] = []
    request_id: str | None = None

class ErrorResponse(BaseModel):
    error: ErrorBody
