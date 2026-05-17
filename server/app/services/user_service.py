import hashlib
import os
from app.models.user import UserCreate, UserLogin

fake_db: list[dict] = []
counter = 1


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 260000)
    return salt.hex() + ":" + key.hex()


def _verify_password(password: str, stored: str) -> bool:
    salt_hex, key_hex = stored.split(":")
    salt = bytes.fromhex(salt_hex)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 260000)
    return key.hex() == key_hex


def get_all_users() -> list[dict]:
    return [_safe(u) for u in fake_db]


def get_user_by_id(user_id: int) -> dict | None:
    user = next((u for u in fake_db if u["id"] == user_id), None)
    return _safe(user) if user else None


def signup_user(user: UserCreate) -> dict:
    global counter
    if any(u["email"] == user.email for u in fake_db):
        raise ValueError("Email already registered")
    record = {
        "id": counter,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "description": user.description,
        "password_hash": _hash_password(user.password),
    }
    fake_db.append(record)
    counter += 1
    return _safe(record)


def login_user(credentials: UserLogin) -> dict:
    user = next((u for u in fake_db if u["email"] == credentials.email), None)
    if not user or not _verify_password(credentials.password, user["password_hash"]):
        raise ValueError("Invalid email or password")
    return _safe(user)


def _safe(user: dict) -> dict:
    return {k: v for k, v in user.items() if k != "password_hash"}
