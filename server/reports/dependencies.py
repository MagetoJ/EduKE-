from fastapi import Depends, HTTPException
from auth import get_current_user

# Single source of truth for report routing
REPORT_ACCESS = {
    "super_admin": ["academic", "financial", "attendance", "enrollment", "hr", "operations", "cbc", "platform"],
    "admin": ["academic", "financial", "attendance", "enrollment", "hr", "operations", "cbc"],
    "hod": ["academic", "attendance", "cbc"],
    "class_teacher": ["academic", "attendance", "cbc"],
    "nurse": ["operations"],
    "librarian": ["operations"],
}

def verify_report_access(domain: str):
    """Dependency to check if the user's role can access a specific report domain."""
    def _verify(current_user = Depends(get_current_user)):
        allowed_domains = REPORT_ACCESS.get(current_user.role, [])
        if domain not in allowed_domains:
            raise HTTPException(
                status_code=403, 
                detail=f"Role '{current_user.role}' is not authorized for {domain} reports."
            )
        return current_user
    return _verify