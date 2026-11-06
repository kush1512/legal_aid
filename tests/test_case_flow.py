def test_case_intake_and_assessment_flow(client,auth_headers):
    created=client.post("/api/v1/cases",headers=auth_headers,json={
        "category":"property_real_estate",
        "description":"A synthetic demo seller accepted payment but has not delivered possession.",
        "jurisdiction":{"country":"IN","state":"Assam"},
        "preferred_language":"en"
    })
    assert created.status_code==201,created.text
    case=created.json()["case"]
    case_id=case["id"]
    assert case["sensitive"] is True

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
