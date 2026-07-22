import re
from typing import Dict, Any, Optional

# Define recognized aliases for each standard database target key
FIELD_ALIASES = {
    "full_name": [
        "full_name", "fullname", "name", "student_name", "student_names", 
        "teacher_name", "staff_name", "user_name", "names", "member_name"
    ],
    "email": [
        "email", "email_address", "mail", "user_email", "student_email", "e-mail"
    ],
    "admission_number": [
        "admission_number", "adm_no", "adm", "admission_no", "student_id", 
        "reg_no", "registration_number", "id_number", "index_number"
    ],
    "class_name": [
        "class_name", "class", "grade", "form", "standard", "level", "year"
    ],
    "stream": [
        "stream", "section", "track", "stream_name", "house"
    ]
}

def normalize_header(header: str) -> str:
    """Cleans a header string: removes special chars, spaces, and lowers case."""
    clean = str(header).strip().lower()
    clean = re.sub(r'[^a-z0-9_]', '_', clean)
    clean = re.sub(r'_+', '_', clean).strip('_')
    return clean

def map_dataframe_headers(df_columns: list) -> Dict[str, str]:
    """
    Maps original dataframe columns to expected backend schema keys.
    Returns a dict like: {'Student Name': 'full_name', 'ADM NO': 'admission_number'}
    """
    mapping = {}
    
    for raw_col in df_columns:
        clean_col = normalize_header(raw_col)
        matched_target = None
        
        # Check against alias lists
        for target_field, aliases in FIELD_ALIASES.items():
            if clean_col in aliases or any(alias in clean_col for alias in aliases):
                matched_target = target_field
                break
        
        if matched_target:
            mapping[raw_col] = matched_target
            
    return mapping