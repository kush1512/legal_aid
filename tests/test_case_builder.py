from app.case_builder import build_case_summary


def test_case_builder_preserves_quotes_and_separates_timeline():
    messages = [
        {"role": "user", "content": "I paid ₹25,000 on 12/10/2026. I have the bank statement and WhatsApp messages.", "created_at": "2026-10-12T10:00:00Z"},
        {"role": "assistant", "content": "When did this happen?"},
        {"role": "user", "content": "The seller promised delivery on 2026-10-20.", "created_at": "2026-10-13T10:00:00Z"},
    ]
    result = build_case_summary(messages, "property_real_estate", {"country": "IN", "state": "Assam"})
    assert {x["value"] for x in result["facts"] if x["key"] == "amount_mentioned"} == {"₹25,000"}
    assert {x["value"] for x in result["facts"] if x["key"] == "date_mentioned"} == {"12/10/2026", "2026-10-20"}
    assert all(x["source"] == "user_provided" and x["verified"] is False for x in result["facts"])
    assert {x["item"] for x in result["evidence"]} == {"bank statement", "whatsapp"}
    assert any("not yet specified" in x["event"] for x in result["timeline"])


def test_case_builder_never_treats_assistant_content_as_evidence():
    result = build_case_summary([
        {"role": "assistant", "content": "You paid ₹99,000 on 01/01/2026 and have a receipt."},
        {"role": "user", "content": "I need help with my landlord."},
    ], "property_real_estate")
    assert result["facts"] == []
    assert result["evidence"] == []


def test_case_builder_marks_evidence_as_unreviewed_and_lists_missing_information():
    result = build_case_summary([
        {"role": "user", "content": "I was scammed through UPI. I have a screenshot."}
    ], "digital_fraud_cybercrime")
    assert result["evidence"][0]["status"] == "mentioned_by_user_not_reviewed"
    assert "Date and time of transaction" in result["missing_information"]
    assert "not independently verified" in result["limitations"][0]
