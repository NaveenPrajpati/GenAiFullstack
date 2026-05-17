from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Literal
import re


class UserCreate(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=50)
    last_name: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    role: Literal["admin", "user"] = "user"
    password: str = Field(..., min_length=8, max_length=128)
    description: Optional[str] = Field(None, max_length=500)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def name_alpha(cls, v: str) -> str:
        if not re.match(r"^[A-Za-z\s\-']+$", v):
            raise ValueError("Name must contain only letters, spaces, hyphens, or apostrophes")
        return v.strip()

    @field_validator("name")
    @classmethod
    def username_clean(cls, v: str) -> str:
        return v.strip()


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    name: str
    email: str
    role: str
    description: Optional[str]

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    message: str
    user: UserResponse
