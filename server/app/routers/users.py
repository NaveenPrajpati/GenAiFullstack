from fastapi import APIRouter, HTTPException
from app.models.user import UserCreate, UserLogin, UserResponse, LoginResponse
from app.services import user_service

router = APIRouter()


@router.post("/signup", response_model=UserResponse, status_code=201)
def signup(user: UserCreate):
    try:
        return user_service.signup_user(user)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/login", response_model=LoginResponse)
def login(credentials: UserLogin):
    try:
        user = user_service.login_user(credentials)
        return {"message": "Login successful", "user": user}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/", response_model=list[UserResponse])
def get_users():
    return user_service.get_all_users()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int):
    user = user_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
