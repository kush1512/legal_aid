def test_case_intake_and_assessment_flow(client,auth_headers):
    created=client.post("/api/v1/cases",headers=auth_headers,json={
        "category":"property_real_estate",
        "description":"A synthetic demo seller accepted payment but has not delivered possession.",
        "jurisdiction":{"country":"IN","state":"Assam"},
        "preferred_language":"en",
        "sensitive":False
    })
    assert created.status_code==201,created.text
    case=created.json()["case"]
    case_id=case["id"]
    assert case["sensitive"] is False
    assert case["synthetic_demo"] is False

    message=client.post(f"/api/v1/cases/{case_id}/messages",headers=auth_headers,json={
        "content":"This is synthetic test information. What details should I collect?"
    })
    assert message.status_code==201,message.text
    assert message.json()["ai"]["provider"]=="mock"
    assert message.json()["ai"]["is_mock"] is True

    listing=client.get("/api/v1/cases",headers=auth_headers)
    assert listing.status_code==200
    assert listing.json()["page"]["total"]==1

    assessment=client.get(f"/api/v1/cases/{case_id}/assessment",headers=auth_headers)
    assert assessment.status_code==200
    value=assessment.json()["assessment"]
    assert value["potentially_relevant_laws"]==[]
    assert value["overall_uncertainty"]=="high"
    assert "not legal advice" in value["disclaimer"].lower()

def test_case_is_not_visible_to_another_user(client,auth_headers):
    created=client.post("/api/v1/cases",headers=auth_headers,json={
        "category":"digital_fraud_cybercrime",
        "description":"Synthetic cyber fraud demonstration facts."
    })
    case_id=created.json()["case"]["id"]
    other={"X-Dev-User-ID":"00000000-0000-4000-8000-000000000002"}
    hidden=client.get(f"/api/v1/cases/{case_id}",headers=other)
    assert hidden.status_code==404

def test_invalid_category_is_rejected(client,auth_headers):
    response=client.post("/api/v1/cases",headers=auth_headers,json={
        "category":"other","description":"Synthetic facts"
    })
    assert response.status_code==422
    assert response.json()["error"]["code"]=="VALIDATION_ERROR"

def test_client_cannot_create_synthetic_case_without_server_allowlist(client,auth_headers):
    response=client.post("/api/v1/cases",headers=auth_headers,json={
        "category":"property_real_estate",
        "description":"Synthetic-only test case.",
        "synthetic_demo":True
    })
    assert response.status_code==403
    assert response.json()["error"]["code"]=="FORBIDDEN"

def test_immediate_safety_risk_returns_official_112_escalation(client,auth_headers):
    created=client.post("/api/v1/cases",headers=auth_headers,json={
        "category":"personal_safety_privacy",
        "description":"Synthetic immediate safety demonstration."
    })
    case_id=created.json()["case"]["id"]
    response=client.post(f"/api/v1/cases/{case_id}/messages",headers=auth_headers,json={
        "content":"My partner is threatening to kill me right now."
    })
    assert response.status_code==201,response.text
    escalation=response.json()["escalation"]
    assert escalation["required"] is True
    assert escalation["contacts"][0]["number"]=="112"
    assert "https://112.gov.in/" in escalation["contacts"][0]["url"]

def test_online_financial_fraud_returns_1930_escalation(client,auth_headers):
    created=client.post("/api/v1/cases",headers=auth_headers,json={
        "category":"digital_fraud_cybercrime",
        "description":"Synthetic online payment fraud demonstration."
    })
    case_id=created.json()["case"]["id"]
    response=client.post(f"/api/v1/cases/{case_id}/messages",headers=auth_headers,json={
        "content":"Someone tricked me into a UPI transfer; money was debited in an online payment scam."
    })
    assert response.status_code==201,response.text
    escalation=response.json()["escalation"]
    assert escalation["required"] is True
    assert escalation["contacts"][0]["number"]=="1930"
    assert escalation["contacts"][0]["url"]=="https://cybercrime.gov.in/"

def test_preliminary_document_draft_is_marked_for_review_and_does_not_invent_sources(client,auth_headers):
    created=client.post("/api/v1/cases",headers=auth_headers,json={
        "category":"property_real_estate",
        "description":"Synthetic case facts for document drafting test."
    })
    assert created.status_code==201,created.text
    case_id=created.json()["case"]["id"]
    response=client.post("/api/v1/documents/generate",headers=auth_headers,json={
        "document_type":"legal_notice",
        "case_id":case_id,
        "instructions":"Prepare a preliminary notice using only the facts.",
        "language":"en"
    })
    assert response.status_code==201,response.text
    draft=response.json()["draft"]
    assert draft["review_required"] is True
    assert draft["citations"]==[]
    assert draft["model"]["is_mock"] is True


def test_case_private_conversation_can_be_enabled_and_disabled(client,auth_headers):
    created=client.post("/api/v1/cases",headers=auth_headers,json={
        "category":"property_real_estate",
        "description":"A non-sensitive test description without personal identifiers.",
        "sensitive":False
    })
    assert created.status_code==201,created.text
    case_id=created.json()["case"]["id"]
    enabled=client.patch(f"/api/v1/cases/{case_id}/privacy",headers=auth_headers,json={
        "private_conversation":True
    })
    assert enabled.status_code==200,enabled.text
    assert enabled.json()["case"]["private_conversation"] is True
    disabled=client.patch(f"/api/v1/cases/{case_id}/privacy",headers=auth_headers,json={
        "private_conversation":False
    })
    assert disabled.status_code==200,disabled.text
    assert disabled.json()["case"]["private_conversation"] is False


def test_sensitive_category_and_personal_identifiers_are_protected(client, auth_headers):
    # Marriage/family is non-sensitive by default and explicit false is respected.
    family = client.post("/api/v1/cases", headers=auth_headers, json={
        "category": "marriage_family",
        "description": "A family matter requiring confidential guidance.",
        "sensitive": False
    })
    assert family.status_code == 201
    assert family.json()["case"]["sensitive"] is False

    # Personal identifiers do not override an explicit user choice.
    pii = client.post("/api/v1/cases", headers=auth_headers, json={
        "category": "property_real_estate",
        "description": "My contact number is 9876543210 and I need help.",
        "sensitive": False
    })
    assert pii.status_code == 201
    assert pii.json()["case"]["sensitive"] is False

    # Personal safety/privacy defaults to sensitive when no choice is supplied.
    safety = client.post("/api/v1/cases", headers=auth_headers, json={
        "category": "personal_safety_privacy",
        "description": "I need confidential guidance."
    })
    assert safety.status_code == 201
    assert safety.json()["case"]["sensitive"] is True