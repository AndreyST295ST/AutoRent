from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum
from datetime import datetime
from app.database import Base

class DocumentStatus(str, PyEnum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"

class ClientDocument(Base):
    __tablename__ = "client_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), unique=True, nullable=False)
    passport_scan_url = Column(String(500))
    license_scan_url = Column(String(500))
    verification_status = Column(Enum(DocumentStatus), default=DocumentStatus.PENDING, nullable=False)
    verified_by = Column(Integer, ForeignKey("users.id"))
    verified_at = Column(DateTime)
    rejection_reason = Column(Text)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    client = relationship("Client", back_populates="documents")

class RentalDocument(Base):
    __tablename__ = "rental_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), unique=True, nullable=False)
    contract_path = Column(String(500))
    act_path = Column(String(500))
    power_of_attorney_path = Column(String(500))
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(Integer, ForeignKey("users.id"))
    
    booking = relationship("Booking", back_populates="rental_documents")

