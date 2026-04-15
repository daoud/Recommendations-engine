"""
Authentication Router
User registration, login, and profile management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.sql import func  # MOVED TO TOP - THIS IS THE FIX
from typing import Optional

import secrets
import random
from datetime import datetime, timedelta

from app.services.database import get_db
from app.models import User, Profile
from app.schemas import UserCreate, UserLogin, UserResponse, Token, ForgotPasswordRequest, ResetPasswordRequest, VerifyEmailRequest, ChangePasswordRequest, UpdateUserRequest, UpdateAvatarRequest
from app.utils import hash_password, verify_password, create_access_token, get_current_user
from app.schemas import TokenData
from app.services.email_service import send_password_reset_email, send_otp_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    
    # Check if email already exists
    existing_user = db.execute(
        select(User).where(User.email == user_data.email)
    ).scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Validate role
    if user_data.role not in ["candidate", "recruiter", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be candidate, recruiter, or admin"
        )
    
    # Create user with OTP
    otp = str(random.randint(100000, 999999))
    new_user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        verification_otp=otp,
        verification_otp_expires=datetime.utcnow() + timedelta(minutes=10)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Send OTP email
    send_otp_email(to_email=new_user.email, otp=otp, first_name=new_user.first_name or "")

    # Create empty profile for candidates
    if user_data.role == "candidate":
        profile = Profile(user_id=new_user.id)
        db.add(profile)
        db.commit()

    return new_user


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login and get access token"""
    
    # Find user by email
    user = db.execute(
        select(User).where(User.email == credentials.email)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated"
        )
    
    # Create token
    access_token = create_access_token(
        data={
            "sub": user.id,
            "email": user.email,
            "role": user.role
        }
    )
    
    # Update last login
    user.last_login_at = func.now()
    db.commit()
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user information"""
    
    user = db.execute(
        select(User).where(User.id == current_user.user_id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.post("/logout")
async def logout(current_user: TokenData = Depends(get_current_user)):
    """
    Logout user.
    Note: JWT tokens are stateless, so actual invalidation requires
    token blacklisting (not implemented in this MVP).
    """
    return {"message": "Successfully logged out"}


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Request a password reset. Sends a reset link to the user's email.
    Always returns success to avoid revealing whether an email is registered.
    """
    user = db.execute(
        select(User).where(User.email == request.email)
    ).scalar_one_or_none()

    if user and user.is_active:
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()
        send_password_reset_email(to_email=user.email, reset_token=token)

    # Always return the same message so attackers cannot enumerate emails
    return {"message": "If that email is registered, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Reset password using the token sent to the user's email.
    """
    user = db.execute(
        select(User).where(User.password_reset_token == request.token)
    ).scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    if user.password_reset_expires is None or datetime.utcnow() > user.password_reset_expires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one."
        )

    user.password_hash = hash_password(request.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    db.commit()

    return {"message": "Password has been reset successfully. You can now log in."}


@router.post("/send-otp")
async def send_otp(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send or resend OTP to the user's registered email."""
    user = db.execute(
        select(User).where(User.id == current_user.user_id)
    ).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.email_verified:
        return {"message": "Email is already verified."}

    otp = str(random.randint(100000, 999999))
    user.verification_otp = otp
    user.verification_otp_expires = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    send_otp_email(to_email=user.email, otp=otp, first_name=user.first_name or "")

    return {"message": "Verification code sent to your email."}


@router.post("/verify-email")
async def verify_email(
    request: VerifyEmailRequest,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify email using the 6-digit OTP."""
    user = db.execute(
        select(User).where(User.id == current_user.user_id)
    ).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.email_verified:
        return {"message": "Email is already verified."}

    if not user.verification_otp or user.verification_otp != request.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code."
        )

    if user.verification_otp_expires is None or datetime.utcnow() > user.verification_otp_expires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new one."
        )

    user.email_verified = True
    user.verification_otp = None
    user.verification_otp_expires = None

    # Also mark candidate profile as verified
    if user.role == "candidate":
        profile = db.execute(
            select(Profile).where(Profile.user_id == user.id)
        ).scalar_one_or_none()
        if profile:
            profile.is_verified = True

    db.commit()

    return {"message": "Email verified successfully!"}


@router.patch("/me", response_model=UserResponse)
async def update_me(
    request: UpdateUserRequest,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the current user's name."""
    user = db.execute(select(User).where(User.id == current_user.user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if request.first_name is not None:
        user.first_name = request.first_name.strip()
    if request.last_name is not None:
        user.last_name = request.last_name.strip()
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change password — requires the current password for verification."""
    user = db.execute(select(User).where(User.id == current_user.user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )

    user.password_hash = hash_password(request.new_password)
    db.commit()
    return {"message": "Password changed successfully."}


@router.post("/avatar", response_model=UserResponse)
async def update_avatar(
    request: UpdateAvatarRequest,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user avatar (accepts base64 data URL)."""
    user = db.execute(select(User).where(User.id == current_user.user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Basic validation: must be a data URL or empty string
    if request.avatar_url and not request.avatar_url.startswith("data:image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Must be a base64 data URL."
        )

    # Limit size to ~2MB (base64 of ~1.5MB image)
    if len(request.avatar_url) > 2_097_152:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image too large. Please use an image under 1.5 MB."
        )

    user.avatar_url = request.avatar_url or None
    db.commit()
    db.refresh(user)
    return user