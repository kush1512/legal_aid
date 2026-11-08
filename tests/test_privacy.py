import pytest
from app.config import Settings
from app.llm import LLMOrchestrator,ProviderError

@pytest.mark.asyncio
async def test_sensitive_payload_is_blocked_before_provider_initialization():
    settings=Settings(
        llm_provider="gemini",llm_model="example-model",
        gemini_api_key="",allow_external_llm_for_sensitive=False,
        fallback_llm_provider="",llm_max_retries=0
    )
    orchestrator=LLMOrchestrator(settings)
    with pytest.raises(ProviderError,match="sensitive case data"):
        await orchestrator.generate_text("synthetic placeholder",sensitive=True,user_consent=False)

@pytest.mark.asyncio
async def test_mock_provider_can_process_development_case():
    settings=Settings(llm_provider="mock",llm_model="mock-legal-aid-v1")
    generation=await LLMOrchestrator(settings).generate_text("synthetic facts",sensitive=True)
    assert generation.is_mock is True
    assert generation.provider=="mock"

@pytest.mark.asyncio
async def test_external_provider_is_blocked_without_global_demo_opt_in():
    settings=Settings(
        llm_provider="gemini",llm_model="test-model",gemini_api_key="",
        allow_external_llm_for_synthetic=False,
        allow_external_llm_for_non_sensitive=False,
        synthetic_demo_user_ids="00000000-0000-4000-8000-000000000001"
    )
    orchestrator=LLMOrchestrator(settings)
    with pytest.raises(ProviderError,match="explicit consent"):
        await orchestrator.generate_text(
            "synthetic facts",sensitive=False,user_consent=True,synthetic_demo=True
        )

@pytest.mark.asyncio
async def test_sensitive_external_provider_requires_separate_opt_in_and_consent():
    settings=Settings(
        llm_provider="gemini",llm_model="test-model",gemini_api_key="",
        allow_external_llm_for_synthetic=True,
        allow_external_llm_for_sensitive=False
    )
    orchestrator=LLMOrchestrator(settings)
    with pytest.raises(ProviderError,match="sensitive case data"):
        await orchestrator.generate_text(
            "synthetic facts",sensitive=True,user_consent=True,synthetic_demo=True
        )


def test_personal_safety_category_defaults_to_private_mode_only():
    from app.main import case_requires_protection

    # Family, property and cyber cases are not automatically marked sensitive.
    assert case_requires_protection("marriage_family", "A fictional inheritance disagreement", False) is False
    assert case_requires_protection("property_real_estate", "A fictional rental deposit dispute", False) is False
    assert case_requires_protection("digital_fraud_cybercrime", "A fictional online scam", False) is False
    # Personal identifiers and an explicit user choice remain protected in every category.
    assert case_requires_protection("property_real_estate", "Call me at 9876543210", False) is True
    assert case_requires_protection("property_real_estate", "A fictional dispute", True) is True
