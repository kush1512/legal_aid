import pytest
from fastapi import HTTPException
from app.main import storage


def test_private_storage_object_paths_are_bound_to_user_and_case():
    user_id="00000000-0000-4000-8000-000000000001"
    case_id="11111111-1111-4111-8111-111111111111"

    storage._assert_case_storage_path(
        user_id,case_id,
        f"{user_id}/{case_id}/random-id/agreement.pdf"
    )

    with pytest.raises(HTTPException) as wrong_user:
        storage._assert_case_storage_path(
            "00000000-0000-4000-8000-000000000002",
            case_id,
            f"{user_id}/{case_id}/random-id/agreement.pdf"
        )
    assert wrong_user.value.status_code==404

    with pytest.raises(HTTPException) as wrong_case:
        storage._assert_case_storage_path(
            user_id,
            "22222222-2222-4222-8222-222222222222",
            f"{user_id}/{case_id}/random-id/agreement.pdf"
        )
    assert wrong_case.value.status_code==404
