"""
Profile Router — v1.3
=====================
Key change: pdfplumber column-aware PDF extraction.
Splits 2-column resumes into left (experience) + right (skills/certs).
"""

import os
import re
import json
import logging
import tempfile
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Profile, Skill, ProfileSkill
from app.auth import get_current_user
from app.schemas import ProfileUpdate, ProfileResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profiles", tags=["profiles"])

# ── Lazy loader for heavy imports ──
_resume_graph = None

def get_resume_graph():
    global _resume_graph
    if _resume_graph is None:
        from app.agents.resume_processor import ResumeProcessingGraph
        try:
            from app.agents.skill_taxonomy import SkillTaxonomyManager
            tax = SkillTaxonomyManager()
            tax.load_all()
            logger.info(f"Taxonomy loaded: {tax.total_skills} skills")
        except Exception as e:
            logger.warning(f"Taxonomy load failed: {e}")
            tax = None
        _resume_graph = ResumeProcessingGraph(taxonomy=tax)
    return _resume_graph


# ============================================================================
# PDF TEXT EXTRACTION — Column-aware with pdfplumber
# ============================================================================

def extract_pdf_text(file_path: str) -> str:
    """Extract text from PDF using pdfplumber with column splitting.
    
    For 2-column resumes: separates left (experience) from right (skills/certs).
    This prevents the LLM from confusing interleaved columns.
    """
    try:
        import pdfplumber
    except ImportError:
        # Fallback to PyPDF2
        logger.warning("pdfplumber not installed, falling back to PyPDF2")
        return _extract_pdf_pypdf2(file_path)

    sections = []

    try:
        with pdfplumber.open(file_path) as pdf:
            num_pages = len(pdf.pages)

            for i, page in enumerate(pdf.pages):
                bbox = page.bbox  # (x0, y0, x1, y1)
                x0, y0, x1, y1 = bbox
                w = x1 - x0

                # Try column split for pages that might be 2-column
                left_text = ""
                right_text = ""
                try:
                    left_crop = page.crop((x0, y0, x0 + w * 0.62, y1))
                    left_text = (left_crop.extract_text(layout=False) or "").strip()

                    right_crop = page.crop((x0 + w * 0.62, y0, x1, y1))
                    right_text = (right_crop.extract_text(layout=False) or "").strip()
                except Exception:
                    left_text = ""
                    right_text = ""

                # If column split produced good results, use it
                if left_text and right_text and len(left_text) > 200:
                    sections.append(f"--- PAGE {i+1} MAIN CONTENT ---\n{left_text}")
                    sections.append(f"--- PAGE {i+1} SIDEBAR ---\n{right_text}")
                else:
                    # Single column page (projects, etc.)
                    full = (page.extract_text(layout=False) or "").strip()
                    if full:
                        sections.append(f"--- PAGE {i+1} ---\n{full}")

        result = "\n\n".join(sections)
        logger.info(f"PDF extracted: {num_pages} pages, {len(result)} chars")
        return result

    except Exception as e:
        logger.error(f"pdfplumber error: {e}, falling back to PyPDF2")
        return _extract_pdf_pypdf2(file_path)


def _extract_pdf_pypdf2(file_path: str) -> str:
    """Fallback PyPDF2 extraction."""
    from PyPDF2 import PdfReader
    reader = PdfReader(file_path)
    text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    return text


# ============================================================================
# HELPERS
# ============================================================================

def _calc_years(parsed_data: dict) -> int:
    """Calculate years of experience from parsed dates."""
    # First check if resume explicitly states years
    # (e.g., "15+ Years Experience")
    meta_text = json.dumps(parsed_data.get("personal_info", {}))
    m = re.search(r'(\d+)\+?\s*[Yy]ears?\s*[Ee]xperience', meta_text)
    if m:
        return int(m.group(1))

    years_set = set()
    for exp in parsed_data.get("experience", []):
        for field in ["start_date", "end_date"]:
            val = str(exp.get(field, ""))
            for ym in re.findall(r'((?:19|20)\d{2})', val):
                years_set.add(int(ym))
            if any(kw in val.lower() for kw in ["present", "current", "ongoing", "till date", "now"]):
                years_set.add(datetime.now().year)

    if len(years_set) >= 2:
        return max(years_set) - min(years_set)
    return 0


def _sync_profile_skills(db: Session, profile: Profile, parsed_data: dict):
    """Sync skills from parsed resume to ProfileSkill table. No duplicates."""
    skills_data = parsed_data.get("skills", {})

    # Collect all skill names (flat list)
    skill_names = []
    if isinstance(skills_data, dict):
        for cat_list in skills_data.values():
            if isinstance(cat_list, list):
                for item in cat_list:
                    if isinstance(item, str):
                        skill_names.append(item)
                    elif isinstance(item, dict) and item.get("name"):
                        skill_names.append(item["name"])
    elif isinstance(skills_data, list):
        for item in skills_data:
            if isinstance(item, str):
                skill_names.append(item)
            elif isinstance(item, dict) and item.get("name"):
                skill_names.append(item["name"])

    if not skill_names:
        return

    # Pre-load existing profile skill IDs
    existing_ids = set(
        db.execute(
            select(ProfileSkill.skill_id).where(ProfileSkill.profile_id == profile.id)
        ).scalars().all()
    )
    seen_ids = set()

    for name in skill_names:
        name = name.strip()
        if not name or len(name) < 2:
            continue

        # Find skill in DB
        skill = db.execute(
            select(Skill).where(Skill.name == name)
        ).scalar_one_or_none()

        if not skill:
            # Try case-insensitive
            from sqlalchemy import func
            skill = db.execute(
                select(Skill).where(func.lower(Skill.name) == name.lower())
            ).scalar_one_or_none()

        if not skill:
            continue

        if skill.id in existing_ids or skill.id in seen_ids:
            continue

        seen_ids.add(skill.id)
        ps = ProfileSkill(profile_id=profile.id, skill_id=skill.id)
        db.add(ps)

    try:
        db.flush()
        logger.info(f"Synced {len(seen_ids)} new skills to profile")
    except Exception as e:
        logger.warning(f"Skill sync error: {e}")
        db.rollback()


# ============================================================================
# ROUTES
# ============================================================================

@router.get("/me", response_model=ProfileResponse)
def get_my_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")
    return profile


@router.put("/me", response_model=ProfileResponse)
def update_profile(data: ProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    for field, value in data.dict(exclude_unset=True).items():
        if hasattr(profile, field):
            setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile


@router.post("/me/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate
    if not file.filename:
        raise HTTPException(400, "No file")
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ("pdf", "doc", "docx"):
        raise HTTPException(400, "Only PDF or Word files")

    profile = db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    # Save temp file
    content = await file.read()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}")
    tmp.write(content)
    tmp.close()

    try:
        # Extract text
        if ext == "pdf":
            resume_text = extract_pdf_text(tmp.name)
        else:
            resume_text = content.decode("utf-8", errors="ignore")

        if not resume_text or len(resume_text) < 50:
            raise HTTPException(400, "Could not extract text from file")

        logger.info(f"Resume text extracted: {len(resume_text)} chars")

        # Parse with multi-agent system
        graph = get_resume_graph()
        parsed_data = graph.process(resume_text, file.filename)

        # Save to profile
        profile.parsed_json_draft = parsed_data
        profile.resume_path = f"local/{current_user.id}/{file.filename}"

        # Auto-populate profile fields from parsed data
        pi = parsed_data.get("personal_info", {})
        loc = pi.get("location", {}) if isinstance(pi.get("location"), dict) else {}
        contact = pi.get("contact", {}) if isinstance(pi.get("contact"), dict) else {}

        if pi.get("headline"):
            profile.headline = pi["headline"]
        if pi.get("summary"):
            profile.summary = pi["summary"]
        if loc.get("city"):
            profile.location_city = loc["city"]
        if loc.get("country"):
            profile.location_country = loc["country"]

        # Calculate years
        years = _calc_years(parsed_data)
        if years > 0:
            profile.years_experience = years

        # Desired role
        if pi.get("desired_role"):
            profile.desired_role = pi["desired_role"]
        elif pi.get("headline"):
            profile.desired_role = pi["headline"]

        # Sync skills
        _sync_profile_skills(db, profile, parsed_data)

        db.commit()
        db.refresh(profile)

        # Stats
        review = parsed_data.get("meta", {}).get("review", {})
        stats = review.get("stats", {})

        return {
            "parsed": True,
            "message": "Resume parsed successfully",
            "stats": stats,
            "confidence": parsed_data.get("meta", {}).get("overall_confidence", 0),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resume processing error: {e}", exc_info=True)
        raise HTTPException(500, f"Processing failed: {str(e)}")
    finally:
        os.unlink(tmp.name)
