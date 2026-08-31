from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import date
from models import AcademicTerm

async def check_and_update_active_term(db: AsyncSession, school_id: int = None) -> AcademicTerm:
    """
    Evaluates the current date and automatically updates the active academic term.
    """
    today = date.today()

    # Query term where today falls within start_date and end_date
    query = select(AcademicTerm).where(
        AcademicTerm.start_date <= today,
        AcademicTerm.end_date >= today,
        AcademicTerm.is_closed == False
    )
    if school_id:
        query = query.where(AcademicTerm.school_id == school_id)

    result = await db.execute(query)
    current_term = result.scalar_one_or_none()

    if current_term and not current_term.is_active:
        # Deactivate all other terms for this school
        deactivate_query = select(AcademicTerm).where(AcademicTerm.is_active == True)
        if school_id:
            deactivate_query = deactivate_query.where(AcademicTerm.school_id == school_id)
        
        active_terms = (await db.execute(deactivate_query)).scalars().all()
        for term in active_terms:
            term.is_active = False

        # Set the current matching term to active
        current_term.is_active = True
        await db.commit()
        await db.refresh(current_term)

    return current_term