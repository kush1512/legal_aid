import pytest
from pydantic import ValidationError

from app.schemas import LegalSourceReviewRequest


def valid_payload():
    return {
        "decision": "verified",
        "rationale": "Reviewed the official publication and checked its legal status.",
        "checklist": {
            "official_source_confirmed": True,
            "document_identity_confirmed": True,
            "content_integrity_confirmed": True,
            "jurisdiction_confirmed": True,
            "effective_dates_reviewed": True,
            "amendments_reviewed": True,
            "legal_applicability_reviewed": True,
        },
    }


def test_legal_source_review_request_accepts_complete_verified_review():
    payload = LegalSourceReviewRequest.model_validate(valid_payload())
    assert payload.decision == "verified"
    assert all(payload.checklist.model_dump().values())


def test_legal_source_review_request_rejects_short_rationale():
    payload = valid_payload()
    payload["rationale"] = "Too short"
    with pytest.raises(ValidationError):
        LegalSourceReviewRequest.model_validate(payload)


def test_legal_source_review_request_rejects_unknown_decision():
    payload = valid_payload()
    payload["decision"] = "approved"
    with pytest.raises(ValidationError):
        LegalSourceReviewRequest.model_validate(payload)


def test_rejection_can_be_recorded_without_approval_checklist():
    payload = valid_payload()
    payload["decision"] = "rejected"
    payload["checklist"] = {
        "official_source_confirmed": False,
        "document_identity_confirmed": False,
        "content_integrity_confirmed": False,
        "jurisdiction_confirmed": False,
        "effective_dates_reviewed": False,
        "amendments_reviewed": False,
        "legal_applicability_reviewed": False,
    }
    review = LegalSourceReviewRequest.model_validate(payload)
    assert review.decision == "rejected"
