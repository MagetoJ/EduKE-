import re
import difflib
from typing import Dict, List

# Define recognized aliases for each standard database target key
FIELD_ALIASES: Dict[str, List[str]] = {
    "full_name": [
        "full_name", "fullname", "name", "student_name", "student_names",
        "teacher_name", "staff_name", "user_name", "names", "member_name",
    ],
    "email": [
        "email", "email_address", "mail", "user_email", "student_email", "e_mail",
    ],
    "admission_number": [
        "admission_number", "adm_no", "adm", "admission_no", "student_id",
        "reg_no", "registration_number", "id_number", "index_number",
    ],
    "class_name": [
        "class_name", "class", "grade", "form", "standard", "level", "year",
    ],
    "stream": [
        "stream", "section", "track", "stream_name", "house",
    ],
}

# Used only in the fuzzy fallback pass (pass 2 below) -- exact matches never
# need this, so a well-formed header ("Full Name", "Admission No") is never
# at the mercy of a similarity score.
FUZZY_MATCH_THRESHOLD = 0.8


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

    Previously this matched by substring containment ("name" in clean_col),
    checked in dict order -- which meant a column literally titled "Class
    Name" got mapped to full_name instead of class_name, because "name" is a
    substring of "class_name" and full_name is checked first. Fixed by doing
    two full passes instead of one column-at-a-time pass:

      Pass 1 (exact match): every column gets checked against every field's
      aliases for an EXACT normalized match first, across the whole file, so
      whichever field a column exactly matches wins regardless of dict order.
      Each field can only be claimed once, and each column can only be
      claimed once.

      Pass 2 (fuzzy fallback): only for columns that got no exact match in
      pass 1 (e.g. a genuine typo like "Studnt Name"), using a similarity
      score against fields that are still unclaimed.
    """
    normalized = {col: normalize_header(col) for col in df_columns}
    mapping: Dict[str, str] = {}
    claimed_targets = set()
    claimed_columns = set()

    # Pass 1: exact match only
    for raw_col, clean_col in normalized.items():
        for target_field, aliases in FIELD_ALIASES.items():
            if target_field in claimed_targets:
                continue
            if clean_col in aliases:
                mapping[raw_col] = target_field
                claimed_targets.add(target_field)
                claimed_columns.add(raw_col)
                break

    # Pass 2: fuzzy fallback for anything still unclaimed
    for raw_col, clean_col in normalized.items():
        if raw_col in claimed_columns:
            continue
        best_target, best_score = None, 0.0
        for target_field, aliases in FIELD_ALIASES.items():
            if target_field in claimed_targets:
                continue
            score = max(difflib.SequenceMatcher(None, clean_col, alias).ratio() for alias in aliases)
            if score > best_score:
                best_target, best_score = target_field, score
        if best_target and best_score >= FUZZY_MATCH_THRESHOLD:
            mapping[raw_col] = best_target
            claimed_targets.add(best_target)
            claimed_columns.add(raw_col)

    return mapping