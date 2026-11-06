def test_audio_type_is_validated_before_external_provider_call(client,auth_headers):
    response=client.post(
        "/api/v1/speech/transcribe",
        headers=auth_headers,
        files={"file":("recording.exe",b"not audio","application/octet-stream")}
    )
    assert response.status_code==415
