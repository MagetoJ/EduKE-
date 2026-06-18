from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import date, datetime

from database import get_db
from models import User, LibraryBook, LibraryIssue, Student
from auth import get_current_user

router = APIRouter(prefix="/api/library", tags=["Library"])

# --- Schemas ---
class BookCreate(BaseModel):
    title: str
    author: Optional[str] = None
    isbn: Optional[str] = None
    category: Optional[str] = None
    total_copies: int = 1
    location_rack: Optional[str] = None

class IssueBookRequest(BaseModel):
    book_id: int
    student_id: Optional[int] = None
    staff_id: Optional[int] = None
    due_date: date

# --- Endpoints ---

@router.get("/books")
def get_books(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    books = db.query(LibraryBook).filter(LibraryBook.school_id == current_user.school_id).all()
    return {"data": books}

@router.post("/books")
def add_book(payload: BookCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_book = LibraryBook(
        **payload.dict(),
        available_copies=payload.total_copies, # Initially, available = total
        school_id=current_user.school_id
    )
    db.add(new_book)
    db.commit()
    db.refresh(new_book)
    return {"data": new_book, "message": "Book added to catalog"}

@router.get("/issues")
def get_issued_books(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    issues = db.query(LibraryIssue).filter(LibraryIssue.school_id == current_user.school_id).all()
    
    # Format the data for the frontend
    results = []
    for issue in issues:
        borrower_name = ""
        if issue.student:
            borrower_name = f"{issue.student.first_name} {issue.student.last_name} (Student)"
        elif issue.staff:
            borrower_name = f"{issue.staff.full_name} (Staff)"

        results.append({
            "id": issue.id,
            "book_title": issue.book.title if issue.book else "Unknown",
            "borrower_name": borrower_name,
            "issue_date": issue.issue_date,
            "due_date": issue.due_date,
            "status": issue.status
        })
    return {"data": results}

@router.post("/issues")
def issue_book(payload: IssueBookRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    book = db.query(LibraryBook).filter(LibraryBook.id == payload.book_id, LibraryBook.school_id == current_user.school_id).first()
    
    if not book or book.available_copies <= 0:
        raise HTTPException(status_code=400, detail="Book not available for issuance")
        
    if not payload.student_id and not payload.staff_id:
        raise HTTPException(status_code=400, detail="Must specify a student or staff to issue to")

    # Create issue record
    new_issue = LibraryIssue(
        school_id=current_user.school_id,
        book_id=payload.book_id,
        student_id=payload.student_id,
        staff_id=payload.staff_id,
        due_date=payload.due_date,
        issued_by=current_user.id
    )
    
    # Decrease available copies
    book.available_copies -= 1
    
    db.add(new_issue)
    db.commit()
    return {"message": "Book issued successfully"}

@router.put("/issues/{issue_id}/return")
def return_book(issue_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    issue = db.query(LibraryIssue).filter(LibraryIssue.id == issue_id, LibraryIssue.school_id == current_user.school_id).first()
    
    if not issue or issue.status == 'returned':
        raise HTTPException(status_code=400, detail="Invalid issue record or already returned")
        
    # Mark as returned
    issue.status = "returned"
    issue.return_date = datetime.utcnow().date()
    
    # Increase available copies
    book = db.query(LibraryBook).filter(LibraryBook.id == issue.book_id).first()
    if book:
        book.available_copies += 1
        
    db.commit()
    return {"message": "Book returned successfully"}