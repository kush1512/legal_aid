import logging
import re
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, Request, UploadFile, File, Form
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.status import HTTP_201_CREATED

from app.ai_models import CaseIntakeResult, DraftContent, AssessmentContent
from app.config import get_settings
from app.embeddings import get_embedding_provider
from app.legal_rag import hybrid_legal_search, verify_indexed_source, get_provision
from app.llm import LLMOrchestrator, ProviderError
from app.schemas import (
    CaseCreateRequest, CaseCreateResponse, CaseListResponse, CaseOut, CaseStatus, AssessmentGenerateRequest,
    MessageCreateRequest, MessageCreateResponse, MessageOut,
    LegalSearchRequest, LegalSearchResponse, LegalSearchItem, CitationOut,
    DocumentGenerateRequest, DraftOut, CommunityPostCreateRequest, CommunityPostOut,
    LawyerOut, ErrorResponse
)
from app.security import get_current_user
from app.storage import Storage, utcnow
from app.speech import GroqWhisperProvider

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("legal_aid.api")
storage = Storage(settings)
llm = LLMOrchestrator(settings)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Basic per-process limiter; use a shared Redis/edge limiter for multi-instance production."""
    def __init__(self, app, max_requests: int, window_seconds: int):
        super().__init__(app)
        self.max_requests=max_requests
        self.window_seconds=window_seconds
        self.hits=defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if request.url.path.endswith("/health"):
            return await call_next(request)
        key=request.client.host if request.client else "unknown"
        now=time.monotonic()
        queue=self.hits[key]
        while queue and queue[0] <= now-self.window_seconds:
            queue.popleft()
        if len(queue) >= self.max_requests:
            request_id=getattr(request.state,"request_id",str(uuid.uuid4()))
            return JSONResponse(status_code=429,content={"error":{
                "code":"RATE_LIMITED","message":"Too many requests. Please retry later.",
                "details":[],"request_id":request_id
            }},headers={"Retry-After":str(self.window_seconds)})
        queue.append(now)
        return await call_next(request)

app = FastAPI(
    title="Legal Aid API", version=settings.app_version,
    description="Privacy-first legal assistance API. AI output is informational and not legal representation.",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url=f"{settings.api_v1_prefix}/docs",
    redoc_url=f"{settings.api_v1_prefix}/redoc"
)
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origin_list,
    allow_credentials=True, allow_methods=["GET","POST","OPTIONS"],
    allow_headers=["Authorization","Content-Type","X-Dev-User-ID","X-Request-ID"]
)
app.add_middleware(RateLimitMiddleware, max_requests=settings.rate_limit_requests,
                    window_seconds=settings.rate_limit_window_seconds)

@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id=request.headers.get("X-Request-ID") or str(uuid.uuid4())
    response=await call_next(request)
    response.headers["X-Request-ID"]=request.state.request_id
    return response

@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    detail=exc.detail
    if isinstance(detail,dict):
        code=detail.get("code","REQUEST_ERROR")
        message=detail.get("message","The request could not be completed.")
        details=detail.get("details",[])
    else:
        message=str(detail)
        code={
            400:"BAD_REQUEST",401:"AUTHENTICATION_REQUIRED",403:"FORBIDDEN",
            404:"RESOURCE_NOT_FOUND",409:"CONFLICT",413:"PAYLOAD_TOO_LARGE",
            415:"UNSUPPORTED_MEDIA_TYPE",422:"VALIDATION_ERROR",429:"RATE_LIMITED",
            502:"PROVIDER_UNAVAILABLE",503:"SERVICE_UNAVAILABLE",504:"PROVIDER_TIMEOUT"
        }.get(exc.status_code,"REQUEST_ERROR")
        if "privacy" in message.lower(): code="PRIVACY_GATE_BLOCKED"
        details=[]
    return JSONResponse(status_code=exc.status_code,content={"error":{
        "code":code,"message":message,"details":details,
        "request_id":getattr(request.state,"request_id",None)
    }})

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    details=[{"field":".".join(str(x) for x in e["loc"]),"issue":e["msg"]} for e in exc.errors()]
    return JSONResponse(status_code=422,content={"error":{
        "code":"VALIDATION_ERROR","message":"The request could not be processed.",
        "details":details,"request_id":getattr(request.state,"request_id",None)
    }})

@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    # Never log exception text/tracebacks: SDK/database errors can include user payloads.
    logger.error("unhandled_error request_id=%s type=%s",
                 getattr(request.state,"request_id","unknown"),type(exc).__name__)
    return JSONResponse(status_code=500,content={"error":{
        "code":"INTERNAL_ERROR","message":"An unexpected error occurred.",
        "details":[],"request_id":getattr(request.state,"request_id",None)
    }})

def pagination(limit: int, offset: int, total: int) -> dict[str,Any]:
    return {"limit":limit,"offset":offset,"total":total,"has_more":offset+limit<total}

def to_case_out(row: dict) -> dict:
    return {
        "id":row["id"],"title":row["title"],"category":row["category"],
        "status":row["status"],"jurisdiction":row.get("jurisdiction") or {"country":"IN"},
        "preferred_language":row.get("preferred_language","en"),
        "sensitive":row.get("sensitive",True),"synthetic_demo":row.get("synthetic_demo",False),
        "created_at":row["created_at"],
        "updated_at":row.get("updated_at",row["created_at"]),
        "latest_message_at":row.get("latest_message_at")
    }

def is_allowlisted_synthetic_user(user: dict) -> bool:
    return user.get("id") in settings.synthetic_demo_user_id_list

def can_use_external_synthetic_ai(user: dict, synthetic_demo: bool, consent: bool) -> bool:
    return bool(
        synthetic_demo
        and consent
        and settings.allow_external_llm_for_synthetic
        and is_allowlisted_synthetic_user(user)
    )

def official_escalation_for_case(category: str, text: str) -> dict[str, Any] | None:
    """Deterministic escalation guidance for known urgent India-specific situations."""
    normalized = " ".join(text.casefold().split())
    contacts: list[dict[str, str]] = []
    instructions: list[str] = []

    immediate_safety_patterns = (
        r"threaten(?:ed|ing)? to kill",
        r"kill me",
        r"(?:attacking|attacked|assaulting|assaulted) me",
        r"trying to hurt me",
        r"life.{0,20}in danger",
        r"unsafe right now",
        r"following me right now",
        r"locked me inside",
        r"trapped inside",
        r"(?:kidnap|abduct)(?:ped|ing)?",
        r"cannot escape",
        r"holding (?:a )?(?:knife|gun|weapon)",
    )
    immediate_safety = any(re.search(pattern, normalized) for pattern in immediate_safety_patterns)

    financial_fraud_terms = (
        "upi", "bank transfer", "money debited", "money transferred",
        "online payment", "card transaction", "wallet transfer", "unauthorised transaction",
        "unauthorized transaction",
    )
    fraud_terms = ("fraud", "scam", "cheated", "deceived", "unauthorised", "unauthorized")
    financial_cyber_fraud = (
        category == "digital_fraud_cybercrime"
        and any(term in normalized for term in financial_fraud_terms)
        and any(term in normalized for term in fraud_terms)
    )

    if immediate_safety:
        contacts.append({
            "name": "India Emergency Response Support System",
            "number": "112",
            "url": "https://112.gov.in/",
        })
        instructions.append(
            "Immediate safety risk detected. Move to a safer place if possible, avoid confronting the person, "
            "and call 112 for emergency police, fire or medical assistance. Use the 112 India app or SOS facility "
            "if calling is not safe."
        )

    if financial_cyber_fraud:
        contacts.append({
            "name": "National Cyber Crime financial-fraud helpline",
            "number": "1930",
            "url": "https://cybercrime.gov.in/",
        })
        instructions.append(
            "For a suspected online financial fraud, report it promptly by calling 1930 and submit the complaint "
            "through the National Cyber Crime Reporting Portal at cybercrime.gov.in. Contact your bank/payment "
            "provider immediately to request protective action."
        )

    if not contacts:
        return None
    return {
        "required": True,
        "priority": "urgent" if immediate_safety else "time_sensitive",
        "instructions": instructions,
        "contacts": contacts,
        "source_note": "Official government escalation channels; this is not a substitute for emergency services.",
    }


def to_message_out(row: dict) -> dict:
    return {
        "id":row["id"],"case_id":row["case_id"],"role":row["role"],
        "content":row["content"],"created_at":row["created_at"],
        "ai_metadata":({
            "provider":row.get("ai_provider"),"model":row.get("ai_model"),
            "is_mock":row.get("ai_is_mock",False)
        } if row["role"]=="assistant" else None)
    }

def valid_audio_signature(extension: str, data: bytes) -> bool:
    if extension == ".wav":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE"
    if extension in {".mp3", ".mpeg", ".mpga"}:
        return data.startswith(b"ID3") or (
            len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0
        )
    if extension == ".m4a":
        return b"ftyp" in data[:16]
    if extension == ".webm":
        return data.startswith(b"\\x1a\\x45\\xdf\\xa3")
    if extension == ".ogg":
        return data.startswith(b"OggS")
    if extension == ".flac":
        return data.startswith(b"fLaC")
    return False


@app.post("/api/v1/speech/transcribe",tags=["speech"])
async def transcribe_audio(
    file: UploadFile=File(...),
    case_id: str | None=Form(default=None),
    external_ai_consent: bool=Form(default=False),
    synthetic_demo: bool=Form(default=False),
    user: dict=Depends(get_current_user)
):
    allowed={
        ".wav":"audio/wav",".mp3":"audio/mpeg",".m4a":"audio/mp4",
        ".mpeg":"audio/mpeg",".mpga":"audio/mpeg",".webm":"audio/webm",
        ".ogg":"audio/ogg",".flac":"audio/flac"
    }
    import os
    extension=os.path.splitext(file.filename or "")[1].lower()
    if extension not in allowed:
        raise HTTPException(415,"Unsupported audio format")
    content_type=(file.content_type or "").lower()
    expected_type=allowed[extension]
    if content_type not in (expected_type,"application/octet-stream"):
        raise HTTPException(415,"Audio content type does not match its extension")
    audio=await file.read(settings.max_audio_bytes+1)
    if len(audio)>settings.max_audio_bytes:
        raise HTTPException(413,"Audio file exceeds the configured size limit")
    if not audio:
        raise HTTPException(422,"Audio file is empty")
    if not valid_audio_signature(extension,audio):
        raise HTTPException(415,"Audio file content does not match its declared format")
    if case_id:
        case=await storage.get_case(user,case_id)
        synthetic_demo=bool(case.get("synthetic_demo",False))
    if not can_use_external_synthetic_ai(user,synthetic_demo,external_ai_consent):
        raise HTTPException(403,{"code":"PRIVACY_GATE_BLOCKED",
                                 "message":"External speech transcription is available only for allowlisted synthetic demonstration cases with explicit consent. Use text input for real cases.",
                                 "details":[]})
    if not settings.groq_api_key:
        raise HTTPException(503,"Speech transcription is not configured; use text input instead")
    try:
        transcript=await GroqWhisperProvider(settings).transcribe(audio,file.filename or "audio"+extension,expected_type)
    except ProviderError as exc:
        raise HTTPException(502,{"code":"PROVIDER_UNAVAILABLE",
                                 "message":"Speech transcription is temporarily unavailable.","details":[]}) from exc
    finally:
        await file.close()
        del audio
    return {"transcript":transcript,"provider":"groq_whisper",
            "model":settings.groq_whisper_model,"audio_stored":False}

@app.get("/api/v1/health", tags=["system"])
async def health():
    return {
        "status":"ok","version":settings.app_version,"environment":settings.app_env,
        "dependencies":{
            "database":"development_memory" if storage.is_mock else (
                "configured" if settings.supabase_url and settings.supabase_anon_key else "not_configured"
            ),
            "llm":"mock" if settings.llm_provider=="mock" else "configured",
            "embeddings":settings.embedding_provider
        }
    }

@app.post("/api/v1/cases", response_model=CaseCreateResponse, status_code=HTTP_201_CREATED, tags=["cases"])
async def create_case(payload: CaseCreateRequest, user: dict=Depends(get_current_user)):
    synthetic_demo=bool(payload.synthetic_demo)
    if synthetic_demo and not is_allowlisted_synthetic_user(user):
        raise HTTPException(403,{"code":"FORBIDDEN",
                                 "message":"This account is not authorized to create synthetic demo cases.",
                                 "details":[]})
    title=payload.title or payload.description.strip().splitlines()[0][:120]
    row=await storage.create_case(user,{
        "user_id":user["id"],"title":title,"category":payload.category.value,
        "status":"intake","jurisdiction":payload.jurisdiction.model_dump(exclude_none=True),
        "preferred_language":payload.preferred_language,
        "synthetic_demo":synthetic_demo,"sensitive":not synthetic_demo
    })
    message=await storage.insert("case_messages",user,{
        "case_id":row["id"],"user_id":user["id"],"role":"user",
        "content":payload.description,"input_mode":"text"
    })
    return {"case":to_case_out(row),"initial_message":to_message_out(message)}

@app.get("/api/v1/cases", response_model=CaseListResponse, tags=["cases"])
async def list_cases(limit: int=Query(20,ge=1,le=100),offset: int=Query(0,ge=0),
                     category: str | None=None,status: str | None=None,
                     user: dict=Depends(get_current_user)):
    rows,total=await storage.list_cases(user,limit,offset,category,status)
    return {"items":[to_case_out(x) for x in rows],"page":pagination(limit,offset,total)}

@app.get("/api/v1/cases/{case_id}", tags=["cases"])
async def get_case(case_id: UUID,user: dict=Depends(get_current_user)):
    row=await storage.get_case(user,str(case_id))
    return {"case":to_case_out(row)}

@app.post("/api/v1/cases/{case_id}/messages",response_model=MessageCreateResponse,
          status_code=HTTP_201_CREATED,tags=["cases"])
async def add_case_message(case_id: UUID,payload: MessageCreateRequest,user: dict=Depends(get_current_user)):
    case=await storage.get_case(user,str(case_id))
    user_message=await storage.insert("case_messages",user,{
        "case_id":str(case_id),"user_id":user["id"],"role":"user",
        "content":payload.content,"input_mode":payload.input_mode
    })
    history=await storage.list_messages(user,str(case_id))
    conversation="\n".join(f'{m["role"]}: {m["content"]}' for m in history[-12:])
    escalation=official_escalation_for_case(case["category"],payload.content)
    prompt=(
        "You are the intake assistant for Legal Aid, an Indian legal information platform. "
        "Understand facts; do not provide a legal conclusion in this intake step. Never invent facts. "
        "Mark user statements as user_provided, and label any inference explicitly. Ask only the most "
        "important missing questions. Detect imminent danger or urgent safety risk and flag it. "
        "Do not cite laws or sections unless separately verified by the legal knowledge base. "
        "If there is immediate physical danger, prioritize emergency safety guidance over legal analysis. "
        "For India, the official emergency response number is 112; for online financial fraud the official "
        "helpline is 1930. Return fields exactly according to the JSON schema.\n"
        f"Case category: {case['category']}\nJurisdiction: {case.get('jurisdiction')}\n"
        f"Conversation:\n{conversation}"
    )
    external_demo_allowed=can_use_external_synthetic_ai(
        user,bool(case.get("synthetic_demo",False)),payload.external_ai_consent
    )
    blocked=(settings.llm_provider!="mock" and not external_demo_allowed)
    if blocked:
        reply=(
            "This case is marked sensitive. No external AI provider was contacted. "
            "You can continue by adding relevant dates, people involved, documents and steps already taken."
        )
        ai={"provider":"privacy_gate","model":"none","is_mock":False,"blocked":True}
        result=None
    else:
        try:
            generation,result=await llm.generate_structured_output(
                prompt,CaseIntakeResult,sensitive=case.get("sensitive",True),
                user_consent=payload.external_ai_consent,
                synthetic_demo=external_demo_allowed,
                model=settings.case_extraction_model or None
            )
            reply=result.assistant_reply
            ai={"provider":generation.provider,"model":generation.model,
                "version":generation.version,"is_mock":generation.is_mock,"blocked":False}
        except ProviderError as exc:
            logger.warning("case_intake_provider_failure provider=%s transient=%s",
                           settings.llm_provider,exc.transient)
            raise HTTPException(502,{"code":"PROVIDER_UNAVAILABLE",
                                     "message":"AI provider is temporarily unavailable. Your message was saved.",
                                     "details":[]})
    if result and result.emergency_detected and escalation is None:
        escalation={
            "required":True,"priority":"urgent",
            "instructions":["The intake system flagged a possible immediate safety emergency. If anyone is in immediate danger, call 112 now."],
            "contacts":[{"name":"India Emergency Response Support System","number":"112","url":"https://112.gov.in/"}],
            "source_note":"Official Government of India emergency channel."
        }
    if escalation:
        reply=reply+"\n\n"+"\n".join(escalation["instructions"])
    assistant=await storage.insert("case_messages",user,{
        "case_id":str(case_id),"user_id":user["id"],"role":"assistant","content":reply,
        "ai_provider":ai["provider"],"ai_model":ai["model"],"ai_is_mock":ai["is_mock"]
    })
    followups=result.follow_up_questions if result else []
    facts=[f.model_dump() for f in result.extracted_facts] if result else []
    for fact in facts:
        await storage.insert("case_facts",user,{
            "case_id":str(case_id),"user_id":user["id"],"fact_key":fact["key"],
            "value":fact["value"],"source":fact["source"],
            "confidence":fact.get("confidence"),"verified":fact.get("verified",False)
        })
    new_status=result.case_status.value if result else "needs_information"
    await storage.update_case_status(user,str(case_id),new_status)
    assessment_payload={
        "summary":"Initial intake summary based only on the conversation. "+(reply[:700] if reply else ""),
        "parties":[],
        "timeline":[],
        "evidence":[],
        "established_facts":[
            f'{fact["key"]}: {fact["value"]}' for fact in facts
            if fact.get("source") in ("user_provided","document")
        ],
        "assumptions":[],
        "unknowns":result.unknowns if result else ["Additional facts are required."],
        "legal_position":"No legal conclusion is made at this intake stage. Current applicable provisions must be retrieved and verified before legal analysis.",
        "potentially_relevant_laws":[],
        "options":[],
        "follow_up_questions":followups,
        "overall_uncertainty":"high",
        "confidence":0.0,
        "escalation_required":bool(escalation) or bool(result.emergency_detected if result else False),
        "escalation_reason":(
            result.emergency_reason if result and result.emergency_reason
            else ("Urgent escalation detected from user-provided facts." if escalation else None)
        ),
        "escalation_details":escalation,
        "disclaimer":"Preliminary AI-assisted information only. This is not legal advice or legal representation. Obtain qualified professional review."
    }
    await storage.insert("case_assessments",user,{
        "case_id":str(case_id),"user_id":user["id"],
        "summary":assessment_payload["summary"],"assessment":assessment_payload,
        "model_provider":ai["provider"],"model_name":ai["model"],
        "model_version":ai.get("version"),"is_mock":ai["is_mock"],
        "retrieved_source_ids":[]
    })
    return {
        "user_message":to_message_out(user_message),
        "assistant_message":to_message_out(assistant),
        "case_status":new_status,
        "follow_up_questions":followups,
        "extracted_facts":facts,
        "ai":ai,
        "escalation":escalation
    }

@app.post("/api/v1/cases/{case_id}/assessment",tags=["cases"])
async def generate_case_assessment(
    case_id: UUID,
    payload: AssessmentGenerateRequest,
    user: dict=Depends(get_current_user)
):
    case=await storage.get_case(user,str(case_id))
    external_demo_allowed=can_use_external_synthetic_ai(
        user,bool(case.get("synthetic_demo",False)),payload.external_ai_consent
    )
    if settings.llm_provider!="mock" and not external_demo_allowed:
        raise HTTPException(403,{"code":"PRIVACY_GATE_BLOCKED",
                                 "message":"External assessment is disabled for real cases. Use the mock provider or an approved synthetic demo account.",
                                 "details":[]})
    messages=await storage.list_messages(user,str(case_id))
    user_text=" ".join(m["content"] for m in messages if m["role"]=="user")
    escalation=official_escalation_for_case(case["category"],user_text)
    conversation="\\n".join(f'{m["role"]}: {m["content"]}' for m in messages[-20:])
    retrieval_query=(case["category"]+" "+str(case.get("jurisdiction"))+" "+
                     " ".join(m["content"] for m in messages if m["role"]=="user"))[:6000]
    retrieved=[]
    try:
        retrieved=await hybrid_legal_search(
            retrieval_query,category=case["category"],
            jurisdiction=(case.get("jurisdiction",{}).get("country","IN")+":"+
                          case.get("jurisdiction",{}).get("state","")) if case.get("jurisdiction",{}).get("state")
                         else case.get("jurisdiction",{}).get("country","IN"),
            limit=8,
            as_of_date=datetime.now(timezone.utc).date()
        )
        retrieved=[row for row in retrieved if verify_indexed_source(row)]
    except HTTPException as exc:
        if exc.status_code!=503:
            raise
        logger.warning("assessment_knowledge_base_unavailable case_id=%s",str(case_id))
    source_context=[
        {
            "source_id":row["id"],"act_name":row.get("act_name"),
            "section_label":row.get("section_label"),"heading":row.get("heading"),
            "source_url":row["source_url"],"verification_status":row["verification_status"],
            "effective_from":row.get("effective_from"),"effective_to":row.get("effective_to"),
            "exact_text":row["content"]
        } for row in retrieved
    ]
    prompt=(
        "You are preparing a preliminary legal information assessment for an Indian legal-aid intake. "
        "Use only facts stated in the conversation. Separate established facts, assumptions and unknowns. "
        "Do not invent parties, dates, events, evidence, statute names, section numbers or legal outcomes. "
        "Only discuss legal provisions included in the VERIFIED SOURCE CONTEXT below. A retrieved match "
        "does not prove legal applicability; explain uncertainty and identify missing facts. If source context "
        "is empty, make no legal conclusion, list no law and say verified source material is unavailable. "
        "Do not claim to be a lawyer or guarantee an outcome. Return the AssessmentContent JSON schema.\n"
        "For immediate danger in India, identify official emergency number 112; for online financial fraud, identify 1930 and cybercrime.gov.in.\n"
        f"Category: {case['category']}\\nJurisdiction: {case.get('jurisdiction')}\\n"
        f"Conversation:\\n{conversation[-30000:]}\\n"
        f"VERIFIED SOURCE CONTEXT:\\n{source_context}"
    )
    try:
        generation,generated=await llm.generate_structured_output(
            prompt,AssessmentContent,sensitive=case.get("sensitive",True),
            user_consent=payload.external_ai_consent,
            synthetic_demo=external_demo_allowed,
            model=settings.legal_explanation_model or None
        )
    except ProviderError as exc:
        if "privacy policy" in str(exc).lower():
            raise HTTPException(403,{"code":"PRIVACY_GATE_BLOCKED",
                                     "message":"External AI assessment is blocked for this sensitive case.",
                                     "details":[]}) from exc
        raise HTTPException(502,{"code":"PROVIDER_UNAVAILABLE",
                                 "message":"The assessment provider is temporarily unavailable.",
                                 "details":[]}) from exc

    fact_rows,_=await storage.list_owned("case_facts",user,100,0,case_id=str(case_id))
    established=[
        f'{fact["fact_key"]}: {fact["value"]}' for fact in fact_rows
        if fact.get("source") in ("user_provided","document")
    ]
    inference_notes=[
        f'{fact["fact_key"]}: {fact["value"]}' for fact in fact_rows
        if fact.get("source")=="ai_inference"
    ]
    assessment_id=str(uuid.uuid4())
    citation_items=[]
    citation_rows=[]
    for row in retrieved:
        citation_id=str(uuid.uuid4())
        exact_ref=", ".join(x for x in [
            row.get("act_name"),row.get("section_label") or row.get("heading")
        ] if x)
        citation={
            "id":citation_id,"legal_document_id":row["legal_document_id"],
            "act_name":row.get("act_name") or "Unspecified Act",
            "section_label":row.get("section_label"),"title":row.get("heading"),
            "source_url":row["source_url"],"source_status":row["verification_status"],
            "effective_from":row.get("effective_from"),"effective_to":row.get("effective_to"),
            "excerpt":row["content"]
        }
        citation_items.append({
            "citation":citation,
            "explanation":"This provision was retrieved by semantic/keyword similarity. Retrieval does not establish applicability.",
            "applicability":"uncertain"
        })
        citation_rows.append({
            "id":citation_id,"case_id":str(case_id),"assessment_id":assessment_id,
            "user_id":user["id"],"legal_document_id":row["legal_document_id"],
            "legal_chunk_id":row["id"],"exact_reference":exact_ref or "Unspecified provision",
            "cited_excerpt":row["content"],"applicability":"uncertain",
            "verification_status":row["verification_status"]
        })
    has_sources=bool(citation_items)
    assessment_payload={
        "summary":generated.summary,
        "parties":generated.parties,
        "timeline":generated.timeline,
        "evidence":generated.evidence,
        "established_facts":established,
        "assumptions":generated.assumptions+inference_notes,
        "unknowns":generated.unknowns,
        "legal_position":generated.legal_position if has_sources else
            "No legal conclusion is made because no verified matching legal provisions were available. Obtain current source material and qualified professional review.",
        "potentially_relevant_laws":citation_items,
        "options":generated.options if has_sources else [],
        "follow_up_questions":generated.follow_up_questions,
        "overall_uncertainty":generated.overall_uncertainty if has_sources else "high",
        "confidence":min(generated.confidence,0.5) if has_sources else 0.0,
        "escalation_required":bool(escalation) or generated.escalation_required,
        "escalation_reason":generated.escalation_reason or ("Urgent escalation detected from user-provided facts." if escalation else None),
        "escalation_details":escalation,
        "disclaimer":"AI-generated preliminary information, not legal advice or representation. All drafts and legal interpretations require review by a qualified professional."
    }
    row=await storage.insert("case_assessments",user,{
        "id":assessment_id,"case_id":str(case_id),"user_id":user["id"],
        "summary":assessment_payload["summary"],"assessment":assessment_payload,
        "model_provider":generation.provider,"model_name":generation.model,
        "model_version":generation.version,"is_mock":generation.is_mock,
        "retrieved_source_ids":[item["id"] for item in retrieved]
    })
    for citation_row in citation_rows:
        await storage.insert("legal_citations",user,citation_row)
    await storage.update_case_status(user,str(case_id),"analysed")
    return {"assessment":{
        "id":row["id"],"case_id":row["case_id"],"generated_at":row["created_at"],
        **assessment_payload,
        "model":{"provider":generation.provider,"name":generation.model,
                 "version":generation.version,"is_mock":generation.is_mock}
    }}

@app.get("/api/v1/cases/{case_id}/assessment",tags=["cases"])
async def get_assessment(case_id: UUID,user: dict=Depends(get_current_user)):
    await storage.get_case(user,str(case_id))
    row=await storage.latest_assessment(user,str(case_id))
    if not row:
        raise HTTPException(404,{"code":"ASSESSMENT_NOT_FOUND",
                                 "message":"No completed assessment is available yet.","details":[]})
    assessment=row["assessment"]
    return {"assessment":{
        "id":row["id"],"case_id":row["case_id"],"generated_at":row["created_at"],
        **assessment,
        "model":{"provider":row["model_provider"],"name":row["model_name"],
                 "version":row.get("model_version"),"is_mock":row.get("is_mock",False)}
    }}

@app.get("/api/v1/cases/{case_id}/documents",tags=["cases"])
async def list_case_documents(case_id: UUID,limit: int=Query(20,ge=1,le=100),
                              offset: int=Query(0,ge=0),user: dict=Depends(get_current_user)):
    await storage.get_case(user,str(case_id))
    rows,total=await storage.list_owned("case_documents",user,limit,offset,case_id=str(case_id))
    items=[]
    for row in rows:
        signed=await storage.signed_url(user,row["storage_path"],300)
        items.append({
            "id":row["id"],"case_id":row["case_id"],"file_name":row["file_name"],
            "mime_type":row["mime_type"],"size_bytes":row["size_bytes"],
            "created_at":row["created_at"],"download_url":signed,
            "download_url_expires_at":(datetime.now(timezone.utc)+timedelta(seconds=300)).isoformat() if signed else None
        })
    return {"items":items,"page":pagination(limit,offset,total)}

@app.post("/api/v1/cases/{case_id}/documents",status_code=HTTP_201_CREATED,tags=["cases"])
async def upload_case_document(
    case_id: UUID,
    file: UploadFile=File(...),
    user: dict=Depends(get_current_user)
):
    await storage.get_case(user,str(case_id))
    import os
    extension=os.path.splitext(file.filename or "")[1].lower()
    allowed={
        ".pdf":("application/pdf",lambda b:b.startswith(b"%PDF-")),
        ".png":("image/png",lambda b:b.startswith(b"\\x89PNG\\r\\n\\x1a\\n")),
        ".jpg":("image/jpeg",lambda b:b.startswith(b"\\xff\\xd8\\xff")),
        ".jpeg":("image/jpeg",lambda b:b.startswith(b"\\xff\\xd8\\xff")),
        ".txt":("text/plain",lambda b: b"\\x00" not in b and _is_utf8(b)),
        ".docx":("application/vnd.openxmlformats-officedocument.wordprocessingml.document",lambda b:b.startswith(b"PK\\x03\\x04")),
        ".doc":("application/msword",lambda b:b.startswith(b"\\xd0\\xcf\\x11\\xe0\\xa1\\xb1\\x1a\\xe1"))
    }
    if extension not in allowed:
        raise HTTPException(415,"Unsupported document format")
    mime_type,signature_check=allowed[extension]
    content=await file.read(settings.max_upload_bytes+1)
    try:
        if not content:
            raise HTTPException(422,"Document is empty")
        if len(content)>settings.max_upload_bytes:
            raise HTTPException(413,"Document exceeds the configured upload limit")
        if not signature_check(content):
            raise HTTPException(415,"File content does not match its extension")
        row=await storage.upload_case_document(
            user,str(case_id),file.filename or "document",mime_type,content,
            hashlib.sha256(content).hexdigest()
        )
    finally:
        await file.close()
    return {"document":{
        "id":row["id"],"case_id":row["case_id"],"file_name":row["file_name"],
        "mime_type":row["mime_type"],"size_bytes":row["size_bytes"],
        "created_at":row["created_at"]
    }}

def _is_utf8(value: bytes) -> bool:
    try:
        value.decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False

@app.post("/api/v1/legal/search",response_model=LegalSearchResponse,tags=["legal"])
async def legal_search(payload: LegalSearchRequest,user: dict=Depends(get_current_user)):
    results=await hybrid_legal_search(
        payload.query,category=payload.category.value if payload.category else None,
        jurisdiction=(payload.jurisdiction.country + ":" + payload.jurisdiction.state) if payload.jurisdiction.state else payload.jurisdiction.country,
        limit=payload.limit,
        as_of_date=payload.as_of_date or datetime.now(timezone.utc).date()
    )
    verified=[r for r in results if verify_indexed_source(r)]
    max_score=max((r["score"] for r in verified),default=1)
    items=[]
    for row in verified:
        methods=row.get("methods",[])
        method="hybrid" if len(set(methods))>1 else (methods[0] if methods else "semantic")
        items.append({
            "citation":{
                "id":row["id"],"legal_document_id":row["legal_document_id"],
                "act_name":row.get("act_name") or "Unspecified Act",
                "section_label":row.get("section_label"),"title":row.get("heading"),
                "source_url":row["source_url"],"source_status":row["verification_status"],
                "effective_from":row.get("effective_from"),"effective_to":row.get("effective_to"),
                "excerpt":row["content"]
            },
            "relevance_score":float(row["score"])/float(max_score or 1),
            "retrieval_method":method
        })
    return {"results":items,
            "warning":"Retrieved source text is not a determination of legal applicability. Check effective dates and consult a qualified professional."}

@app.get("/api/v1/legal/provision/{provision_id}",tags=["legal"])
async def get_legal_provision(provision_id: UUID,user: dict=Depends(get_current_user)):
    provision=await get_provision(str(provision_id))
    if not provision or provision["source_status"] not in ("verified","historical") or not str(provision.get("source_url","")).startswith("https://"):
        raise HTTPException(404,"Verified legal provision not found")
    return {"provision":{
        "citation":{
            "id":provision["id"],"legal_document_id":provision["legal_document_id"],
            "act_name":provision.get("act_name") or "Unspecified Act",
            "section_label":provision.get("section_label"),"title":provision.get("heading"),
            "source_url":provision["source_url"],"source_status":provision["source_status"],
            "effective_from":provision.get("effective_from"),"effective_to":provision.get("effective_to"),
            "excerpt":provision["full_text"]
        },
        "full_text":provision["full_text"],"document_version":provision.get("document_version"),
        "effective_from":provision.get("effective_from"),"effective_to":provision.get("effective_to"),
        "jurisdiction":provision.get("jurisdiction")
    }}

@app.post("/api/v1/documents/generate",response_model=dict,status_code=HTTP_201_CREATED,tags=["documents"])
async def generate_document(payload: DocumentGenerateRequest,user: dict=Depends(get_current_user)):
    case=None
    context=payload.facts or {}
    synthetic_demo=bool(payload.synthetic_demo)
    sensitive=not synthetic_demo
    if payload.case_id:
        case=await storage.get_case(user,str(payload.case_id))
        synthetic_demo=bool(case.get("synthetic_demo",False))
        sensitive=bool(case.get("sensitive",True))
        messages=await storage.list_messages(user,str(payload.case_id))
        context={
            "category":case["category"],"jurisdiction":case.get("jurisdiction"),
            "conversation":[{"role":m["role"],"content":m["content"]} for m in messages[-20:]]
        }
    external_demo_allowed=can_use_external_synthetic_ai(user,synthetic_demo,payload.external_ai_consent)
    if settings.llm_provider!="mock" and not external_demo_allowed:
        raise HTTPException(403,{"code":"PRIVACY_GATE_BLOCKED",
                                 "message":"External drafting is disabled for real cases. Use the mock provider or an approved synthetic demo account.",
                                 "details":[]})
    prompt=(
        "Prepare a preliminary Indian legal document draft. Do not invent facts, dates, names, "
        "addresses, case numbers, statutory sections or procedural history. Use explicit [PLACEHOLDER] "
        "fields for missing information. Cite no law unless supplied as a verified source (none supplied "
        "in this request). Do not claim it has been filed, served, approved or legally reviewed. "
        "Return title, content and placeholders as JSON.\n"
        f"Document type: {payload.document_type}\nLanguage: {payload.language}\n"
        f"User instructions: {payload.instructions}\nFacts/context: {context}"
    )
    try:
        generation,draft=await llm.generate_structured_output(
            prompt,DraftContent,sensitive=sensitive,user_consent=payload.external_ai_consent,
            synthetic_demo=external_demo_allowed,
            model=settings.document_draft_model or None
        )
    except ProviderError as exc:
        raise HTTPException(502,{"code":"PROVIDER_UNAVAILABLE",
                                 "message":"The drafting provider is unavailable.","details":[]}) from exc
    row=await storage.insert("generated_drafts",user,{
        "case_id":str(payload.case_id) if payload.case_id else None,"user_id":user["id"],
        "document_type":payload.document_type,"title":draft.title,"content":draft.content,
        "placeholders":draft.placeholders,"citation_ids":[],"review_required":True,
        "model_provider":generation.provider,"model_name":generation.model,"is_mock":generation.is_mock
    })
    return {"draft":{
        "id":row["id"],"case_id":row["case_id"],"document_type":row["document_type"],
        "title":row["title"],"content":row["content"],"placeholders":row["placeholders"],
        "citations":[],"review_required":True,"created_at":row["created_at"],
        "model":{"provider":generation.provider,"name":generation.model,"is_mock":generation.is_mock}
    }}

@app.get("/api/v1/community/posts",tags=["community"])
async def list_community_posts(limit: int=Query(20,ge=1,le=100),offset: int=Query(0,ge=0),
                               category: str | None=None,sort: str="newest",
                               user: dict=Depends(get_current_user)):
    if sort not in ("newest","popular"):
        raise HTTPException(422,"sort must be newest or popular")
    rows,total=await storage.approved_posts(user,limit,offset,category,sort)
    items=[{
        "id":x["id"],"title":x["title"],"content":x["content"],"category":x["category"],
        "display_name":"Anonymous" if x.get("anonymous") else (x.get("display_name") or "Community member"),
        "anonymous":x.get("anonymous",False),"created_at":x["created_at"],
        "comment_count":int(x.get("comment_count",0)),
        "vote_count":int(x.get("vote_count",0))
    } for x in rows]
    return {"items":items,"page":pagination(limit,offset,total)}

@app.post("/api/v1/community/posts",status_code=HTTP_201_CREATED,tags=["community"])
async def create_community_post(payload: CommunityPostCreateRequest,user: dict=Depends(get_current_user)):
    row=await storage.insert("community_posts",user,{
        "user_id":user["id"],"title":payload.title,"content":payload.content,
        "category":payload.category.value,"anonymous":payload.anonymous,
        "display_name":None if payload.anonymous else "Community member",
        "moderation_status":"pending"
    })
    return {"post":{
        "id":row["id"],"title":row["title"],"content":row["content"],"category":row["category"],
        "display_name":"Anonymous" if payload.anonymous else "Community member",
        "anonymous":payload.anonymous,"created_at":row["created_at"],
        "comment_count":0,"vote_count":0,"moderation_status":"pending"
    }}

@app.get("/api/v1/lawyers",tags=["lawyers"])
async def list_lawyers(limit: int=Query(20,ge=1,le=100),offset: int=Query(0,ge=0),
                       category: str | None=None,state: str | None=None,city: str | None=None,
                       language: str | None=None,user: dict=Depends(get_current_user)):
    rows,total=await storage.verified_lawyers(user,limit,offset,category,state,city,language)
    return {"items":[{
        "id":x["id"],"display_name":x["display_name"],
        "bar_council_enrolment":x.get("bar_council_enrolment"),
        "jurisdictions":x.get("jurisdictions",[]),"practice_areas":x.get("practice_areas",[]),
        "languages":x.get("languages",[]),"verification_status":x["verification_status"],
        "bio":x.get("bio"),"city":x.get("city"),"state":x.get("state")
    } for x in rows],"page":pagination(limit,offset,total)}

@app.get("/api/v1/lawyers/{lawyer_id}",tags=["lawyers"])
async def get_lawyer(lawyer_id: UUID,user: dict=Depends(get_current_user)):
    row=await storage.get_lawyer(user,str(lawyer_id))
    if not row: raise HTTPException(404,"Verified lawyer not found")
    return {"lawyer":{
        "id":row["id"],"display_name":row["display_name"],
        "bar_council_enrolment":row.get("bar_council_enrolment"),
        "jurisdictions":row.get("jurisdictions",[]),"practice_areas":row.get("practice_areas",[]),
        "languages":row.get("languages",[]),"verification_status":row["verification_status"],
        "bio":row.get("bio"),"city":row.get("city"),"state":row.get("state")
    }}
