from app.main import settings


def test_report_moderation_and_lawyer_verification_workflow(client,auth_headers,monkeypatch):
    post_response=client.post("/api/v1/community/posts",headers=auth_headers,json={
        "title":"Synthetic community post",
        "content":"This is a synthetic report and moderation workflow test.",
        "category":"property_real_estate",
        "anonymous":True
    })
    assert post_response.status_code==201,post_response.text
    post_id=post_response.json()["post"]["id"]

    profile_response=client.post("/api/v1/lawyers",headers=auth_headers,json={
        "display_name":"Synthetic Test Advocate",
        "bio":"Synthetic profile used only for backend workflow testing.",
        "bar_council_enrolment":"TEST/0000/DEMO",
        "jurisdictions":["Assam"],
        "practice_areas":["property_real_estate"],
        "languages":["en","as"],
        "city":"Guwahati",
        "state":"Assam"
    })
    assert profile_response.status_code==201,profile_response.text
    lawyer_id=profile_response.json()["lawyer"]["id"]
    assert profile_response.json()["lawyer"]["verification_status"]=="pending"

    # Pending content cannot be reported or seen in the public feed.
    hidden_report=client.post("/api/v1/reports",headers=auth_headers,json={
        "post_id":post_id,
        "reason":"Synthetic moderation test report"
    })
    assert hidden_report.status_code==404

    # The account must be explicitly allowlisted by backend configuration.
    assert client.get("/api/v1/admin/reports",headers=auth_headers).status_code==403
    monkeypatch.setattr(settings,"admin_user_ids",auth_headers["X-Dev-User-ID"])

    approved=client.patch(
        f"/api/v1/admin/community/posts/{post_id}/moderation",
        headers=auth_headers,
        json={"moderation_status":"approved"}
    )
    assert approved.status_code==200,approved.text
    public_feed=client.get("/api/v1/community/posts",headers=auth_headers)
    assert public_feed.status_code==200
    assert public_feed.json()["page"]["total"]==1
    assert public_feed.json()["items"][0]["display_name"]=="Anonymous"

    report_response=client.post("/api/v1/reports",headers=auth_headers,json={
        "post_id":post_id,
        "reason":"Synthetic moderation test report",
        "details":"This report exists only to validate the admin workflow."
    })
    assert report_response.status_code==201,report_response.text
    report_id=report_response.json()["report"]["id"]

    reports=client.get("/api/v1/admin/reports",headers=auth_headers)
    assert reports.status_code==200,reports.text
    assert reports.json()["page"]["total"]==1

    resolved=client.patch(f"/api/v1/admin/reports/{report_id}",headers=auth_headers,json={
        "status":"resolved"
    })
    assert resolved.status_code==200,resolved.text
    assert resolved.json()["report"]["status"]=="resolved"

    verified=client.patch(
        f"/api/v1/admin/lawyers/{lawyer_id}/verification",
        headers=auth_headers,
        json={"status":"verified","notes":"Synthetic test verification only."}
    )
    assert verified.status_code==200,verified.text
    assert verified.json()["lawyer"]["verification_status"]=="verified"

    lawyer_report=client.post("/api/v1/reports",headers=auth_headers,json={
        "lawyer_id":lawyer_id,
        "reason":"Synthetic verification audit"
    })
    assert lawyer_report.status_code==201,lawyer_report.text

    lawyer_list=client.get("/api/v1/lawyers",headers=auth_headers)
    assert lawyer_list.status_code==200
    assert lawyer_list.json()["page"]["total"]==1
