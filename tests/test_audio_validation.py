def test_audio_type_is_validated_before_external_provider_call(client,auth_headers):
    response=client.post(
        "/api/v1/speech/transcribe",
        headers=auth_headers,
        files={"file":("recording.exe",b"not audio","application/octet-stream")}
    )
    assert response.status_code==415

def test_external_transcription_is_blocked_without_synthetic_demo_authorization(client,auth_headers):
    response=client.post(
        "/api/v1/speech/transcribe",
        headers=auth_headers,
        files={"file":("recording.wav",b"RIFF\\x04\\x00\\x00\\x00WAVE","audio/wav")}
    )
    assert response.status_code==403
    assert response.json()["error"]["code"]=="PRIVACY_GATE_BLOCKED"
