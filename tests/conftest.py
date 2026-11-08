import os
os.environ.setdefault("APP_ENV","development")
os.environ.setdefault("DEV_AUTH_BYPASS","true")
os.environ.setdefault("MOCK_STORAGE","true")
os.environ.setdefault("RATE_LIMIT_REQUESTS","10000")
os.environ.setdefault("LLM_PROVIDER","mock")
os.environ.setdefault("LLM_MODEL","mock-legal-aid-v1")
os.environ.setdefault("ALLOW_EXTERNAL_LLM_FOR_SENSITIVE","false")

os.environ["SYNTHETIC_DEMO_USER_IDS"] = "test-user-not-allowlisted"

import pytest
from fastapi.testclient import TestClient
from app.main import app, storage

@pytest.fixture
def client():
    for rows in storage._memory.values():
        rows.clear()
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def auth_headers():
    return {"X-Dev-User-ID":"00000000-0000-4000-8000-000000000001"}
