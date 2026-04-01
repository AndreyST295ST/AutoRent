from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum
from datetime import datetime
from app.database import Base

class UserRole(str, PyEnum):
    CLIENT = "client"
    EMPLOYEE = "employee"
    ADMIN = "admin"

class UserStatus(str, PyEnum):
    INACTIVE = "inactive"
    ACTIVE = "active"
    BLOCKED = "blocked"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    phone = Column(String(20))
    role = Column(Enum(UserRole), default=UserRole.CLIENT, nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.INACTIVE, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = Column(DateTime)
    
    # Relationships
    client_profile = relationship("Client", back_populates="user", uselist=False)

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    registration_date = Column(DateTime, default=datetime.utcnow)
    activated_at = Column(DateTime)
    
    user = relationship("User", back_populates="client_profile")
    documents = relationship("ClientDocument", back_populates="client", uselist=False)
    bookings = relationship("Booking", back_populates="client")
    reviews = relationship("Review", back_populates="client")

class ActivationToken(Base):
    __tablename__ = "activation_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    token = Column(String(255), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

