import uuid
from typing import Any
import jwt
from fastapi import Header, HTTPException, status
from jwt import PyJWKClient
from app.config import get_settings

def get_current_user(authorization: str | None = Header(default=None),
                     x_dev_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    settings = get_settings()
    if settings.app_env == "development" and settings.dev_auth_bypass and x_dev_user_id:
        try:
            user_id = str(uuid.UUID(x_dev_user_id))
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Invalid development user ID") from exc
        return {"id": user_id, "token": None, "dev": True}

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    token = authorization.split(" ", 1)[1].strip()
    if not settings.supabase_url:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    issuer = settings.supabase_url.rstrip("/") + "/auth/v1"
    try:
        if settings.supabase_jwt_secret:
            claims = jwt.decode(
                token, settings.supabase_jwt_secret, algorithms=["HS256"],
                audience="authenticated", issuer=issuer
            )
        else:
            jwks = PyJWKClient(issuer + "/.well-known/jwks.json", cache_keys=True)
            signing_key = jwks.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token, signing_key.key, algorithms=["ES256", "RS256"],
                audience="authenticated", issuer=issuer
            )
        user_id = str(uuid.UUID(claims["sub"]))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token") from exc
    return {"id": user_id, "token": token, "dev": False}
