def test_health_is_public_and_does_not_leak_secrets(client):
    response=client.get("/api/v1/health")
    assert response.status_code==200
    body=response.json()
    assert body["status"]=="ok"
    assert body["dependencies"]["llm"]=="mock"
    assert "SUPABASE_SERVICE_ROLE_KEY" not in response.text
