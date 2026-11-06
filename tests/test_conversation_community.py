from app.ai_models import CaseIntakeResult, ExtractedFact
from app.llm import Generation
from app.main import settings, storage


def test_case_messages_endpoint_returns_owned_conversation(client,auth_headers):
    created=client.post("/api/v1/cases",headers=auth_headers,json={
        "category":"property_real_estate",
        "description":"Synthetic case about a property agreement."
    })
    assert created.status_code==201,created.text
    case_id=created.json()["case"]["id"]

    sent=client.post(f"/api/v1/cases/{case_id}/messages",headers=auth_headers,json={
        "content":"The possession date has passed."
    })
    assert sent.status_code==201,sent.text

    history=client.get(f"/api/v1/cases/{case_id}/messages",headers=auth_headers)
    assert history.status_code==200
    assert [item["role"] for item in history.json()["items"]]==["user","user","assistant"]

    other={"X-Dev-User-ID":"00000000-0000-4000-8000-000000000002"}
    hidden=client.get(f"/api/v1/cases/{case_id}/messages",headers=other)
    assert hidden.status_code==404


def test_fact_provenance_requires_verbatim_user_quote(client,auth_headers,monkeypatch):
    async def fake_generate(prompt,response_model,**kwargs):
        parsed=CaseIntakeResult(
            assistant_reply="I have recorded the stated date.",
            extracted_facts=[
                ExtractedFact(
                    key="agreement_date",value="2 January",
                    source="user_provided",evidence_quote="My agreement was signed on 2 January.",
                    confidence=0.99,verified=True
                ),
                ExtractedFact(
                    key="payment_amount",value="INR 50000",
                    source="user_provided",evidence_quote="I paid INR 50000.",
                    confidence=0.99,verified=True
                )
            ]
        )
        return Generation("{}", "mock", "test-double", is_mock=True), parsed

    monkeypatch.setattr("app.main.llm.generate_structured_output",fake_generate)
    created=client.post("/api/v1/cases",headers=auth_headers,json={
        "category":"property_real_estate",
        "description":"Synthetic case intake for evidence provenance."
    })
    case_id=created.json()["case"]["id"]
    sent=client.post(f"/api/v1/cases/{case_id}/messages",headers=auth_headers,json={
        "content":"My agreement was signed on 2 January."
    })
    assert sent.status_code==201,sent.text

    rows=[row for row in storage._memory["case_facts"] if row["case_id"]==case_id]
    by_key={row["fact_key"]:row for row in rows}
    assert by_key["agreement_date"]["source"]=="user_provided"
    assert by_key["agreement_date"]["evidence_quote"]=="My agreement was signed on 2 January."
    assert by_key["agreement_date"]["verified"] is False
    assert by_key["payment_amount"]["source"]=="ai_inference"
    assert by_key["payment_amount"]["evidence_quote"] is None
    assert by_key["payment_amount"]["verified"] is False


def test_comments_are_moderated_and_votes_are_upserted(client,auth_headers,monkeypatch):
    monkeypatch.setattr(settings,"admin_user_ids",auth_headers["X-Dev-User-ID"])
    post=client.post("/api/v1/community/posts",headers=auth_headers,json={
        "title":"Synthetic community moderation example",
        "content":"A synthetic example post used for tests only.",
        "category":"property_real_estate",
        "anonymous":True
    })
    assert post.status_code==201,post.text
    post_id=post.json()["post"]["id"]

    pending_comment=client.post(
        f"/api/v1/community/posts/{post_id}/comments",
        headers=auth_headers,json={"content":"A synthetic comment for moderation."}
    )
    assert pending_comment.status_code==201,pending_comment.text
    comment_id=pending_comment.json()["comment"]["id"]

    hidden=client.get(f"/api/v1/community/posts/{post_id}/comments",headers=auth_headers)
    assert hidden.status_code==200
    assert hidden.json()["page"]["total"]==0

    approved_post=client.patch(
        f"/api/v1/admin/community/posts/{post_id}/moderation",
        headers=auth_headers,json={"moderation_status":"approved"}
    )
    assert approved_post.status_code==200,approved_post.text
    approved_comment=client.patch(
        f"/api/v1/admin/community/comments/{comment_id}/moderation",
        headers=auth_headers,json={"moderation_status":"approved"}
    )
    assert approved_comment.status_code==200,approved_comment.text

    comments=client.get(f"/api/v1/community/posts/{post_id}/comments",headers=auth_headers)
    assert comments.status_code==200
    assert comments.json()["page"]["total"]==1
    assert comments.json()["items"][0]["display_name"]=="Community member"

    first_vote=client.post(f"/api/v1/community/posts/{post_id}/votes",headers=auth_headers,json={"value":1})
    second_vote=client.post(f"/api/v1/community/posts/{post_id}/votes",headers=auth_headers,json={"value":-1})
    assert first_vote.status_code==200 and second_vote.status_code==200
    assert second_vote.json()["vote"]["value"]==-1

    feed=client.get("/api/v1/community/posts",headers=auth_headers)
    assert feed.json()["items"][0]["vote_count"]==1

    removed=client.delete(f"/api/v1/community/posts/{post_id}/votes",headers=auth_headers)
    assert removed.status_code==200 and removed.json()["removed"] is True
    feed=client.get("/api/v1/community/posts",headers=auth_headers)
    assert feed.json()["items"][0]["vote_count"]==0


def test_users_cannot_comment_on_unapproved_post(client,auth_headers):
    post=client.post("/api/v1/community/posts",headers=auth_headers,json={
        "title":"Pending synthetic post",
        "content":"This post is pending moderation.",
        "category":"property_real_estate"
    })
    post_id=post.json()["post"]["id"]
    response=client.post(
        f"/api/v1/community/posts/{post_id}/comments",
        headers=auth_headers,json={"content":"This comment should not be accepted."}
    )
    assert response.status_code==404
