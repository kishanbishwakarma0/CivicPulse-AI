import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel


AUTHORITY_USERNAME = os.getenv("AUTHORITY_USERNAME")
AUTHORITY_PASSWORD = os.getenv("AUTHORITY_PASSWORD")
AUTH_TOKEN_SECRET = os.getenv("AUTH_TOKEN_SECRET")

if not AUTHORITY_USERNAME:
    raise RuntimeError("AUTHORITY_USERNAME is missing from environment variables.")

if not AUTHORITY_PASSWORD:
    raise RuntimeError("AUTHORITY_PASSWORD is missing from environment variables.")

if not AUTH_TOKEN_SECRET:
    raise RuntimeError("AUTH_TOKEN_SECRET is missing from environment variables.")


TOKEN_EXPIRY_SECONDS = 60 * 60 * 8

security = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str
    password: str


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + ("=" * (4 - len(value) % 4)))


def _sign(payload: str) -> str:
    signature = hmac.new(
        AUTH_TOKEN_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return _encode(signature)


def create_access_token(username: str) -> str:
    now = int(time.time())
    payload = {
        "sub": username,
        "role": "authority",
        "iat": now,
        "exp": now + TOKEN_EXPIRY_SECONDS,
    }

    encoded_payload = _encode(
        json.dumps(
            payload,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    )

    return f"{encoded_payload}.{_sign(encoded_payload)}"


def verify_access_token(token: str) -> dict:
    try:
        encoded_payload, signature = token.split(".", 1)

        if not hmac.compare_digest(signature, _sign(encoded_payload)):
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token.",
            )

        payload = json.loads(_decode(encoded_payload).decode("utf-8"))

        if payload.get("role") != "authority":
            raise HTTPException(
                status_code=403,
                detail="Authority access required.",
            )

        if int(payload.get("exp", 0)) <= int(time.time()):
            raise HTTPException(
                status_code=401,
                detail="Authentication session expired.",
            )

        if not payload.get("sub"):
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication session.",
            )

        return payload

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token.",
        )


def authenticate_authority(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authority authentication required.",
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Bearer authentication required.",
        )

    return verify_access_token(credentials.credentials)


def authenticate_login(username: str, password: str) -> str:
    if not hmac.compare_digest(username, AUTHORITY_USERNAME):
        raise HTTPException(
            status_code=401,
            detail="Invalid authority username or password.",
        )

    if not hmac.compare_digest(password, AUTHORITY_PASSWORD):
        raise HTTPException(
            status_code=401,
            detail="Invalid authority username or password.",
        )

    return create_access_token(username)
