from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date, datetime, timedelta

from database import get_db
from models import User, LibraryBook, LibraryIssue, Student, School
from auth import get_current_user, get_current_school, require_roles

router = APIRouter(prefix="/api/library", tags=["Library"])

# --- Role groups -------------------------------------------------------
# Anyone who can catalog books, issue/return/renew, and see the full
# ledger. Mirrors the pattern in leave_requests.py / discipline.py.
LIBRARY_MANAGE_ROLES = ("admin", "librarian", "super_admin")

# Everyone who can at least browse the catalog and see their own loans.
# Deliberately broad — a school-wide OPAC, not a management console.
LIBRARY_VIEW_ROLES = (
    "admin", "librarian", "super_admin", "teacher", "class_teacher", "hod",
    "student", "parent", "registrar", "exam_officer", "cbc_coordinator",
)

# Flat fine rate applied per day overdue. There's no per-school setting
# for this yet (School model has no library config), so it's a constant
# here. If/when schools need to customize it, promote this into a School
# column (e.g. library_fine_per_day) and read it off `school`.
FINE_PER_DAY_KES = 5.0
DEFAULT_LOAN_DAYS = 14
RENEWAL_DAYS = 14


# --- Schemas -------------------------------------------------------------
class BookCreate(BaseModel):
    title: str
    author: Optional[str] = None
    isbn: Optional[str] = None
    publisher: Optional[str] = None
    publication_year: Optional[int] = None
    category: Optional[str] = None
    subject_id: Optional[int] = None
    total_copies: int = Field(default=1, ge=1)
    location_rack: Optional[str] = None


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    isbn: Optional[str] = None
    publisher: Optional[str] = None
    publication_year: Optional[int] = None
    category: Optional[str] = None
    subject_id: Optional[int] = None
    total_copies: Optional[int] = Field(default=None, ge=1)
    location_rack: Optional[str] = None


class IssueBookRequest(BaseModel):
    book_id: int
    student_id: Optional[int] = None
    staff_id: Optional[int] = None
    due_date: Optional[date] = None  # defaults to today + DEFAULT_LOAN_DAYS


class ReturnBookRequest(BaseModel):
    fine_paid: bool = False


# --- Helpers ---------------------------------------------------------------
def _book_out(book: LibraryBook) -> dict:
    return {
        "id": book.id,
        "title": book.title,
        "author": book.author,
        "isbn": book.isbn,
        "publisher": book.publisher,
        "publication_year": book.publication_year,
        "category": book.category,
        "subject_id": book.subject_id,
        "total_copies": book.total_copies,
        "available_copies": book.available_copies,
        "location_rack": book.location_rack,
    }


def _issue_out(issue: LibraryIssue) -> dict:
    is_overdue = issue.status == "issued" and issue.due_date < date.today()
    borrower_name = None
    borrower_type = None
    if issue.student:
        borrower_name = f"{issue.student.first_name} {issue.student.last_name}"
        borrower_type = "student"
    elif issue.staff:
        borrower_name = issue.staff.full_name
        borrower_type = "staff"

    return {
        "id": issue.id,
        "book_id": issue.book_id,
        "book_title": issue.book.title if issue.book else "Unknown",
        "borrower_name": borrower_name,
        "borrower_type": borrower_type,
        "student_id": issue.student_id,
        "staff_id": issue.staff_id,
        "issue_date": issue.issue_date.isoformat() if issue.issue_date else None,
        "due_date": issue.due_date.isoformat() if issue.due_date else None,
        "return_date": issue.return_date.isoformat() if issue.return_date else None,
        "status": "overdue" if is_overdue else issue.status,
        "fine_amount": issue.fine_amount,
        "fine_paid": issue.fine_paid,
    }


# --- Catalog ---------------------------------------------------------------
@router.get("/books")
async def get_books(
    q: Optional[str] = None,
    category: Optional[str] = None,
    school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*LIBRARY_VIEW_ROLES)),
):
    """Browse/search the catalog. Open to any school role (student/parent included)."""
    query = select(LibraryBook).where(LibraryBook.school_id == school.id)

    if q:
        like = f"%{q}%"
        query = query.where(
            or_(
                LibraryBook.title.ilike(like),
                LibraryBook.author.ilike(like),
                LibraryBook.isbn.ilike(like),
            )
        )
    if category:
        query = query.where(LibraryBook.category == category)

    query = query.order_by(LibraryBook.title)
    result = await db.execute(query)
    books = result.scalars().all()
    return {"success": True, "data": [_book_out(b) for b in books]}


@router.post("/books")
async def add_book(
    payload: BookCreate,
    school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*LIBRARY_MANAGE_ROLES)),
):
    new_book = LibraryBook(
        **payload.model_dump(),
        available_copies=payload.total_copies,
        school_id=school.id,
    )
    db.add(new_book)
    await db.commit()
    await db.refresh(new_book)
    return {"success": True, "message": "Book added to catalog", "data": _book_out(new_book)}


@router.put("/books/{book_id}")
async def update_book(
    book_id: int,
    payload: BookUpdate,
    school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*LIBRARY_MANAGE_ROLES)),
):
    result = await db.execute(
        select(LibraryBook).where(LibraryBook.id == book_id, LibraryBook.school_id == school.id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    updates = payload.model_dump(exclude_unset=True)

    # Keep available_copies consistent if total_copies shrinks/grows.
    if "total_copies" in updates:
        copies_on_loan = book.total_copies - book.available_copies
        new_total = updates["total_copies"]
        if new_total < copies_on_loan:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot set total copies below {copies_on_loan}, the number currently on loan",
            )
        book.available_copies = new_total - copies_on_loan

    for field, value in updates.items():
        setattr(book, field, value)

    await db.commit()
    await db.refresh(book)
    return {"success": True, "message": "Book updated", "data": _book_out(book)}


@router.delete("/books/{book_id}")
async def delete_book(
    book_id: int,
    school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*LIBRARY_MANAGE_ROLES)),
):
    result = await db.execute(
        select(LibraryBook).where(LibraryBook.id == book_id, LibraryBook.school_id == school.id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    outstanding = await db.execute(
        select(func.count(LibraryIssue.id)).where(
            LibraryIssue.book_id == book_id, LibraryIssue.status == "issued"
        )
    )
    if outstanding.scalar_one() > 0:
        raise HTTPException(status_code=400, detail="Cannot delete a book with copies still on loan")

    await db.delete(book)
    await db.commit()
    return {"success": True, "message": "Book removed from catalog"}


# --- Issues / circulation ---------------------------------------------------
@router.get("/issues")
async def get_issued_books(
    status_filter: Optional[str] = None,  # issued | returned | overdue
    school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*LIBRARY_MANAGE_ROLES)),
):
    query = select(LibraryIssue).where(LibraryIssue.school_id == school.id).order_by(
        LibraryIssue.issue_date.desc()
    )
    result = await db.execute(query)
    issues = result.scalars().all()

    data = [_issue_out(i) for i in issues]
    if status_filter:
        data = [d for d in data if d["status"] == status_filter]

    return {"success": True, "data": data}


@router.get("/my-loans")
async def get_my_loans(
    token_data: tuple = Depends(get_current_user),
    school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
):
    """Self-service: a student or staff member's own borrow history. No role
    gate beyond being an authenticated member of the school — students and
    parents need this to check what's out/overdue."""
    current_user, _payload = token_data

    student_result = await db.execute(
        select(Student.id).where(Student.user_id == current_user.id, Student.school_id == school.id)
    )
    student_id = student_result.scalar_one_or_none()

    conditions = [LibraryIssue.school_id == school.id]
    if student_id:
        conditions.append(LibraryIssue.student_id == student_id)
    else:
        conditions.append(LibraryIssue.staff_id == current_user.id)

    result = await db.execute(
        select(LibraryIssue).where(and_(*conditions)).order_by(LibraryIssue.issue_date.desc())
    )
    issues = result.scalars().all()
    return {"success": True, "data": [_issue_out(i) for i in issues]}


@router.post("/issues")
async def issue_book(
    payload: IssueBookRequest,
    token_data: tuple = Depends(get_current_user),
    school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*LIBRARY_MANAGE_ROLES)),
):
    current_user, _payload = token_data

    if not payload.student_id and not payload.staff_id:
        raise HTTPException(status_code=400, detail="Must specify a student or staff member to issue to")
    if payload.student_id and payload.staff_id:
        raise HTTPException(status_code=400, detail="Issue to either a student or a staff member, not both")

    result = await db.execute(
        select(LibraryBook).where(LibraryBook.id == payload.book_id, LibraryBook.school_id == school.id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.available_copies <= 0:
        raise HTTPException(status_code=400, detail="No copies of this book are currently available")

    due_date = payload.due_date or (date.today() + timedelta(days=DEFAULT_LOAN_DAYS))

    new_issue = LibraryIssue(
        school_id=school.id,
        book_id=payload.book_id,
        student_id=payload.student_id,
        staff_id=payload.staff_id,
        issue_date=date.today(),
        due_date=due_date,
        status="issued",
        issued_by=current_user.id,
    )
    book.available_copies -= 1

    db.add(new_issue)
    await db.commit()
    await db.refresh(new_issue)
    return {"success": True, "message": "Book issued successfully", "data": _issue_out(new_issue)}


@router.put("/issues/{issue_id}/return")
async def return_book(
    issue_id: int,
    payload: ReturnBookRequest = ReturnBookRequest(),
    school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*LIBRARY_MANAGE_ROLES)),
):
    result = await db.execute(
        select(LibraryIssue).where(LibraryIssue.id == issue_id, LibraryIssue.school_id == school.id)
    )
    issue = result.scalar_one_or_none()
    if not issue or issue.status == "returned":
        raise HTTPException(status_code=400, detail="Invalid issue record or already returned")

    today = date.today()
    issue.status = "returned"
    issue.return_date = today

    if today > issue.due_date:
        days_late = (today - issue.due_date).days
        issue.fine_amount = round(days_late * FINE_PER_DAY_KES, 2)
    issue.fine_paid = payload.fine_paid

    book_result = await db.execute(select(LibraryBook).where(LibraryBook.id == issue.book_id))
    book = book_result.scalar_one_or_none()
    if book and book.available_copies < book.total_copies:
        book.available_copies += 1

    await db.commit()
    await db.refresh(issue)
    return {"success": True, "message": "Book returned successfully", "data": _issue_out(issue)}


@router.put("/issues/{issue_id}/renew")
async def renew_book(
    issue_id: int,
    school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*LIBRARY_MANAGE_ROLES)),
):
    result = await db.execute(
        select(LibraryIssue).where(LibraryIssue.id == issue_id, LibraryIssue.school_id == school.id)
    )
    issue = result.scalar_one_or_none()
    if not issue or issue.status != "issued":
        raise HTTPException(status_code=400, detail="Only active loans can be renewed")

    issue.due_date = issue.due_date + timedelta(days=RENEWAL_DAYS)
    await db.commit()
    await db.refresh(issue)
    return {"success": True, "message": "Loan renewed", "data": _issue_out(issue)}


# --- Dashboard summary -------------------------------------------------------
@router.get("/stats")
async def get_library_stats(
    school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*LIBRARY_MANAGE_ROLES)),
):
    totals = await db.execute(
        select(
            func.coalesce(func.sum(LibraryBook.total_copies), 0),
            func.coalesce(func.sum(LibraryBook.available_copies), 0),
            func.count(LibraryBook.id),
        ).where(LibraryBook.school_id == school.id)
    )
    total_copies, available_copies, title_count = totals.one()

    issues_result = await db.execute(
        select(LibraryIssue.status, LibraryIssue.due_date).where(LibraryIssue.school_id == school.id)
    )
    rows = issues_result.all()
    issued_count = sum(1 for status_, _ in rows if status_ == "issued")
    overdue_count = sum(1 for status_, due in rows if status_ == "issued" and due < date.today())

    return {
        "success": True,
        "data": {
            "title_count": title_count,
            "total_copies": total_copies,
            "available_copies": available_copies,
            "copies_on_loan": total_copies - available_copies,
            "active_loans": issued_count,
            "overdue_loans": overdue_count,
        },
    }