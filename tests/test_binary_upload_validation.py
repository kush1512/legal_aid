from io import BytesIO
from zipfile import ZipFile

def create_case(client,auth_headers):
    response=client.post("/api/v1/cases",headers=auth_headers,json={
        "category":"property_real_estate",
        "description":"Synthetic document upload validation case."
    })
    assert response.status_code==201,response.text
    return response.json()["case"]["id"]


def test_invalid_audio_magic_bytes_are_rejected(client,auth_headers):
    response=client.post(
        "/api/v1/speech/transcribe",
        headers=auth_headers,
        files={"file":("recording.webm",b"not a Matroska/WebM file","audio/webm")}
    )
    assert response.status_code==415
    assert "content does not match" in response.json()["error"]["message"]


def test_invalid_png_signature_is_rejected_before_storage(client,auth_headers):
    case_id=create_case(client,auth_headers)
    response=client.post(
        f"/api/v1/cases/{case_id}/documents",
        headers=auth_headers,
        files={"file":("evidence.png",b"not a PNG file","image/png")}
    )
    assert response.status_code==415


def test_valid_jpeg_signature_reaches_storage_layer(client,auth_headers):
    case_id=create_case(client,auth_headers)
    jpeg=bytes.fromhex("ffd8ffe000104a4649460001") + b"synthetic"
    response=client.post(
        f"/api/v1/cases/{case_id}/documents",
        headers=auth_headers,
        files={"file":("evidence.jpg",jpeg,"image/jpeg")}
    )
    # The dev-memory adapter intentionally refuses persistent file uploads.
    assert response.status_code==503
    assert "requires Supabase" in response.json()["error"]["message"]


def test_docx_must_be_a_real_ooxml_zip_container(client,auth_headers):
    case_id=create_case(client,auth_headers)
    response=client.post(
        f"/api/v1/cases/{case_id}/documents",
        headers=auth_headers,
        files={"file":("fake.docx",b"PK\\x03\\x04not-a-zip","application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    )
    assert response.status_code==415


def test_valid_minimal_docx_is_recognized(client,auth_headers):
    case_id=create_case(client,auth_headers)
    buffer=BytesIO()
    with ZipFile(buffer,"w") as archive:
        archive.writestr("[Content_Types].xml","<Types/>")
        archive.writestr("word/document.xml","<document/>")
    response=client.post(
        f"/api/v1/cases/{case_id}/documents",
        headers=auth_headers,
        files={"file":("valid.docx",buffer.getvalue(),"application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    )
    assert response.status_code==503
    assert "requires Supabase" in response.json()["error"]["message"]
