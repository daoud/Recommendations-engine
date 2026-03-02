"""
Resume Processing Graph - Multi-Agent System
==============================================
Implements ResumeProcessingGraph from the technical specification.

Agents:
  1. ExtractorA - High-recall extraction (extract everything possible)
  2. ExtractorB - High-precision verification (only verifiable facts)
  3. JudgeAgent - Reconciles disagreements between A and B
  4. SkillNormalizerAgent - Maps skills to taxonomy + categorizes
  5. ReviewerAgent - Quality check

Output Schema:
  Comprehensive resume JSON with personal_info, experience, education,
  skills (categorized), certifications, projects, publications, awards,
  languages, volunteer_experience, interests, references, meta.

Location: job-recommendation-engine/api/app/agents/resume_processor.py
"""

import os
import re
import json
import logging
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime

logger = logging.getLogger(__name__)


# ============================================================================
# TARGET OUTPUT SCHEMA (for reference)
# ============================================================================

RESUME_SCHEMA = {
    "personal_info": {
        "full_name": "", "first_name": "", "last_name": "",
        "headline": "", "summary": "", "date_of_birth": "",
        "gender": "", "nationality": "",
        "location": {"address": "", "city": "", "country": ""},
        "contact": {"email": "", "phone": "", "alternate_phone": ""},
        "online_profiles": [],
        "work_authorization": "", "current_salary": "",
        "expected_salary": "", "notice_period": ""
    },
    "experience": [],
    "education": [],
    "skills": {
        "technical_skills": [], "soft_skills": [], "tools": [],
        "frameworks": [], "programming_languages": [],
        "skill_proficiency": []
    },
    "certifications": [],
    "projects": [],
    "publications": [],
    "awards": [],
    "languages": [],
    "volunteer_experience": [],
    "interests": [],
    "references": [],
    "meta": {"source_file": "", "parser_version": "", "parsed_date": ""}
}


# ============================================================================
# HELPER: Safe JSON parser
# ============================================================================

def safe_parse_json(text: str, default=None):
    if not text or not isinstance(text, str):
        return default if default is not None else {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    for pattern in [r'```json\s*([\s\S]*?)\s*```', r'```\s*([\s\S]*?)\s*```']:
        match = re.search(pattern, text)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                continue
    for pattern in [r'\{[\s\S]*\}', r'\[[\s\S]*\]']:
        match = re.search(pattern, text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return default if default is not None else {}


# ============================================================================
# GROQ LLM CLIENT
# ============================================================================

class GroqClient:
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY", "")
        self.model = model or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from groq import Groq
            self._client = Groq(api_key=self.api_key)
        return self._client

    def generate(self, prompt: str, system_prompt: str = "",
                 temperature: float = 0.1, max_tokens: int = 4096) -> str:
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            response = self.client.chat.completions.create(
                model=self.model, messages=messages,
                temperature=temperature, max_tokens=max_tokens
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"LLM error: {e}")
            return ""


# ============================================================================
# AGENT 1: EXTRACTOR A (High Recall)
# ============================================================================

class ExtractorA:
    """Primary extractor - HIGH RECALL. Extract everything possible."""

    def __init__(self, llm: GroqClient):
        self.llm = llm

    def extract(self, text: str) -> Tuple[Dict, float]:
        logger.info("[ExtractorA] Extracting with HIGH RECALL...")

        prompt = f"""You are an expert resume parser. Extract ALL information from this resume thoroughly.

RESUME TEXT:
{text[:8000]}

Extract into this EXACT JSON structure. Use null for missing fields, not empty strings:

{{
    "personal_info": {{
        "full_name": "string or null",
        "first_name": "string or null",
        "last_name": "string or null",
        "headline": "current job title or professional headline or null",
        "summary": "professional summary if present or null",
        "date_of_birth": "string or null",
        "gender": "string or null",
        "nationality": "string or null",
        "location": {{
            "address": "string or null",
            "city": "string or null",
            "country": "string or null"
        }},
        "contact": {{
            "email": "string or null",
            "phone": "string or null",
            "alternate_phone": "string or null"
        }},
        "online_profiles": [
            {{"type": "linkedin or github or portfolio", "url": "string"}}
        ],
        "work_authorization": "string or null",
        "current_salary": "string or null",
        "expected_salary": "string or null",
        "notice_period": "string or null"
    }},
    "experience": [
        {{
            "company": "string",
            "job_title": "string",
            "employment_type": "full-time or part-time or contract or internship or freelance or null",
            "industry": "string or null",
            "location": "string or null",
            "start_date": "YYYY-MM or YYYY or string",
            "end_date": "YYYY-MM or YYYY or present or null",
            "is_current": true/false,
            "responsibilities": ["responsibility 1", "responsibility 2"],
            "achievements": ["achievement 1"],
            "technologies_used": ["tech1", "tech2"]
        }}
    ],
    "education": [
        {{
            "degree": "string",
            "field_of_study": "string or null",
            "institution": "string",
            "location": "string or null",
            "start_date": "string or null",
            "end_date": "string or null",
            "grade": "GPA or percentage or null",
            "description": "string or null"
        }}
    ],
    "skills": [
        {{"name": "string", "category": "programming_language or framework or tool or technical or soft_skill", "proficiency": "beginner or intermediate or advanced or expert or null", "years": null}}
    ],
    "certifications": [
        {{"name": "string", "issuer": "string or null", "issue_date": "string or null", "expiration_date": "string or null", "credential_id": "string or null"}}
    ],
    "projects": [
        {{"name": "string", "description": "string or null", "role": "string or null", "technologies": [], "start_date": "string or null", "end_date": "string or null", "url": "string or null"}}
    ],
    "publications": [
        {{"title": "string", "publisher": "string or null", "date": "string or null", "url": "string or null"}}
    ],
    "awards": [
        {{"title": "string", "issuer": "string or null", "date": "string or null", "description": "string or null"}}
    ],
    "languages": [
        {{"language": "string", "proficiency": "native or fluent or intermediate or basic"}}
    ],
    "volunteer_experience": [
        {{"organization": "string", "role": "string", "start_date": "string or null", "end_date": "string or null", "description": "string or null"}}
    ],
    "interests": ["interest1", "interest2"],
    "references": [
        {{"name": "string", "designation": "string or null", "company": "string or null", "contact": "string or null"}}
    ]
}}

IMPORTANT RULES:
1. Extract ALL skills from everywhere: skills section, experience descriptions, projects, certifications
2. For experience, separate responsibilities from achievements
3. Include technologies_used for each experience entry
4. Extract years of experience per skill when mentioned (e.g., "5 years Python" → years: 5)
5. Set is_current=true for the most recent job if end_date is "present" or missing
6. Split full_name into first_name and last_name
7. headline = most recent job title if not explicitly stated
8. Return ONLY valid JSON, no other text."""

        system = "You are ExtractorA: high-recall resume parser. Extract everything possible. Return only valid JSON."
        response = self.llm.generate(prompt, system, temperature=0.1, max_tokens=6000)
        data = safe_parse_json(response, {})

        confidence = self._score(data)
        logger.info(f"[ExtractorA] Done | confidence={confidence:.2f} | "
                     f"skills={len(data.get('skills', []))}, "
                     f"exp={len(data.get('experience', []))}")
        return data, confidence

    def _score(self, data: Dict) -> float:
        s = 0.0
        if data.get("personal_info", {}).get("full_name"):
            s += 0.2
        if data.get("personal_info", {}).get("contact", {}).get("email"):
            s += 0.1
        if data.get("experience") and len(data["experience"]) > 0:
            s += 0.3
        if data.get("skills") and len(data["skills"]) > 0:
            s += 0.2
        if data.get("education") and len(data["education"]) > 0:
            s += 0.2
        return min(s, 1.0)


# ============================================================================
# AGENT 2: EXTRACTOR B (High Precision)
# ============================================================================

class ExtractorB:
    """Verification extractor - HIGH PRECISION. Only verifiable facts."""

    def __init__(self, llm: GroqClient):
        self.llm = llm

    def extract(self, text: str) -> Tuple[Dict, float]:
        logger.info("[ExtractorB] Extracting with HIGH PRECISION...")

        prompt = f"""You are a precise resume parser. ONLY extract information EXPLICITLY stated in the text.
Do NOT infer, assume, or make up anything.

RESUME TEXT:
{text[:8000]}

STRICT RULES:
1. ONLY include facts directly written in the text
2. If something is not stated, use null — do NOT guess
3. For skills, only include if the word appears in the resume
4. For dates, only include if written
5. Do NOT infer industry, employment_type, or proficiency unless stated
6. Be CONSERVATIVE — precision over recall

Extract into this JSON:
{{
    "personal_info": {{
        "full_name": "only if explicitly written",
        "first_name": "string or null",
        "last_name": "string or null",
        "headline": "only if explicitly stated as headline/title",
        "summary": "only if there is a summary/objective section",
        "date_of_birth": "null unless written",
        "gender": "null unless written",
        "nationality": "null unless written",
        "location": {{"address": "null", "city": "string or null", "country": "string or null"}},
        "contact": {{"email": "string or null", "phone": "string or null", "alternate_phone": "null"}},
        "online_profiles": [],
        "work_authorization": "null unless stated",
        "current_salary": "null unless stated",
        "expected_salary": "null unless stated",
        "notice_period": "null unless stated"
    }},
    "experience": [
        {{
            "company": "string or null",
            "job_title": "string",
            "employment_type": "null unless stated",
            "industry": "null unless stated",
            "location": "string or null",
            "start_date": "only if written",
            "end_date": "only if written or present",
            "is_current": true/false,
            "responsibilities": ["only explicitly listed items"],
            "achievements": ["only explicitly listed achievements"],
            "technologies_used": ["only explicitly mentioned tech"]
        }}
    ],
    "education": [
        {{
            "degree": "string", "field_of_study": "string or null",
            "institution": "string", "location": "null unless stated",
            "start_date": "null", "end_date": "string or null",
            "grade": "null unless stated", "description": "null"
        }}
    ],
    "skills": [
        {{"name": "string", "category": "programming_language or framework or tool or technical or soft_skill", "proficiency": "null unless stated", "years": "integer or null only if stated"}}
    ],
    "certifications": [{{"name": "string", "issuer": "string or null", "issue_date": "null", "expiration_date": "null", "credential_id": "null"}}],
    "projects": [{{"name": "string", "description": "string or null", "role": "null", "technologies": [], "start_date": "null", "end_date": "null", "url": "null"}}],
    "publications": [],
    "awards": [],
    "languages": [{{"language": "string", "proficiency": "string or null"}}],
    "volunteer_experience": [],
    "interests": [],
    "references": []
}}

Return ONLY valid JSON. Be CONSERVATIVE."""

        system = "You are ExtractorB: precision-focused parser. Only include verifiable facts. Return only valid JSON."
        response = self.llm.generate(prompt, system, temperature=0.0, max_tokens=6000)
        data = safe_parse_json(response, {})

        confidence = self._score(data)
        logger.info(f"[ExtractorB] Done | confidence={confidence:.2f} | "
                     f"skills={len(data.get('skills', []))}, "
                     f"exp={len(data.get('experience', []))}")
        return data, confidence

    def _score(self, data: Dict) -> float:
        s = 0.0
        if data.get("personal_info", {}).get("full_name"):
            s += 0.25
        if data.get("experience") and len(data["experience"]) > 0:
            s += 0.3
        if data.get("skills") and len(data["skills"]) > 0:
            s += 0.25
        if data.get("education") and len(data["education"]) > 0:
            s += 0.2
        return min(s, 1.0)


# ============================================================================
# AGENT 3: JUDGE (Reconciler)
# ============================================================================

class JudgeAgent:
    """Reconciles A (recall) and B (precision). B wins on facts, A fills gaps."""

    def __init__(self, llm: GroqClient):
        self.llm = llm

    def reconcile(self, extraction_a: Dict, confidence_a: float,
                  extraction_b: Dict, confidence_b: float,
                  original_text: str) -> Dict:
        logger.info("[JudgeAgent] Reconciling A (recall) + B (precision)...")

        merged = {}

        # --- personal_info: prefer B for facts, A for extras ---
        pi_a = extraction_a.get("personal_info", {})
        pi_b = extraction_b.get("personal_info", {})
        merged["personal_info"] = self._deep_merge(pi_a, pi_b, prefer_b=True)

        # Ensure first/last name split
        pi = merged["personal_info"]
        if pi.get("full_name") and not pi.get("first_name"):
            parts = pi["full_name"].strip().split(" ", 1)
            pi["first_name"] = parts[0]
            pi["last_name"] = parts[1] if len(parts) > 1 else ""

        # Headline fallback
        if not pi.get("headline"):
            exps = extraction_a.get("experience", []) or extraction_b.get("experience", [])
            if exps and isinstance(exps[0], dict):
                pi["headline"] = exps[0].get("job_title", "")

        # --- experience: merge, B details preferred ---
        merged["experience"] = self._merge_lists(
            extraction_a.get("experience", []),
            extraction_b.get("experience", []),
            key="job_title"
        )

        # --- education ---
        merged["education"] = self._merge_lists(
            extraction_a.get("education", []),
            extraction_b.get("education", []),
            key="institution"
        )

        # --- skills: UNION (A has more, B is verified) ---
        merged["skills"] = self._merge_skills(
            extraction_a.get("skills", []),
            extraction_b.get("skills", [])
        )

        # --- certifications ---
        merged["certifications"] = self._merge_lists(
            extraction_a.get("certifications", []),
            extraction_b.get("certifications", []),
            key="name"
        )

        # --- projects: prefer A (more complete) ---
        merged["projects"] = self._merge_lists(
            extraction_a.get("projects", []),
            extraction_b.get("projects", []),
            key="name"
        )

        # --- simple lists: union ---
        merged["publications"] = self._merge_lists(
            extraction_a.get("publications", []),
            extraction_b.get("publications", []),
            key="title"
        )
        merged["awards"] = self._merge_lists(
            extraction_a.get("awards", []),
            extraction_b.get("awards", []),
            key="title"
        )
        merged["languages"] = self._merge_lists(
            extraction_a.get("languages", []),
            extraction_b.get("languages", []),
            key="language"
        )
        merged["volunteer_experience"] = self._merge_lists(
            extraction_a.get("volunteer_experience", []),
            extraction_b.get("volunteer_experience", []),
            key="organization"
        )
        merged["references"] = self._merge_lists(
            extraction_a.get("references", []),
            extraction_b.get("references", []),
            key="name"
        )

        # Interests: union of both
        interests_a = set(extraction_a.get("interests", []) or [])
        interests_b = set(extraction_b.get("interests", []) or [])
        merged["interests"] = list(interests_a | interests_b)

        skills_count = len(merged.get("skills", []))
        exp_count = len(merged.get("experience", []))
        logger.info(f"[JudgeAgent] Merged: {skills_count} skills, {exp_count} experiences")
        return merged

    def _deep_merge(self, dict_a: Any, dict_b: Any, prefer_b: bool = True) -> Any:
        """Recursively merge dicts. B values preferred when both exist."""
        if not isinstance(dict_a, dict) or not isinstance(dict_b, dict):
            if prefer_b and dict_b not in (None, "", [], {}):
                return dict_b
            return dict_a if dict_a not in (None, "", [], {}) else dict_b

        result = {}
        all_keys = set(list(dict_a.keys()) + list(dict_b.keys()))
        for key in all_keys:
            val_a = dict_a.get(key)
            val_b = dict_b.get(key)
            if isinstance(val_a, dict) and isinstance(val_b, dict):
                result[key] = self._deep_merge(val_a, val_b, prefer_b)
            elif isinstance(val_a, list) and isinstance(val_b, list):
                # For lists, take the longer one or B
                result[key] = val_b if len(val_b) >= len(val_a) else val_a
            elif prefer_b and val_b not in (None, "", [], {}):
                result[key] = val_b
            elif val_a not in (None, "", [], {}):
                result[key] = val_a
            else:
                result[key] = val_b if val_b is not None else val_a
        return result

    def _merge_lists(self, list_a: List, list_b: List, key: str) -> List:
        """Merge lists of dicts, dedup by key. B details preferred."""
        seen = set()
        merged = []
        # B first (precision), then A fills gaps
        for item in (list_b or []) + (list_a or []):
            if isinstance(item, dict):
                item_key = str(item.get(key) or "").lower().strip()
                if item_key and item_key not in seen:
                    seen.add(item_key)
                    merged.append(item)
                elif not item_key and item:
                    merged.append(item)
        return merged

    def _merge_skills(self, skills_a: List, skills_b: List) -> List:
        """Union of skills. B details preferred."""
        skill_map = {}
        for s in (skills_a or []):
            if isinstance(s, dict) and s.get("name"):
                name = s["name"].lower().strip()
                skill_map[name] = s
        for s in (skills_b or []):
            if isinstance(s, dict) and s.get("name"):
                name = s["name"].lower().strip()
                existing = skill_map.get(name, {})
                skill_map[name] = {**existing, **{k: v for k, v in s.items() if v is not None}}
        return list(skill_map.values())


# ============================================================================
# AGENT 4: SKILL NORMALIZER + CATEGORIZER
# ============================================================================

class SkillNormalizerAgent:
    """Maps skills to taxonomy and categorizes into:
    programming_languages, frameworks, tools, technical_skills, soft_skills"""

    # Category classification rules
    PROGRAMMING_LANGUAGES = {
        'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'go', 'golang',
        'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'sql', 'bash',
        'shell', 'perl', 'matlab', 'dart', 'lua', 'html', 'css', 'sass', 'less',
        'objective-c', 'assembly', 'haskell', 'elixir', 'clojure', 'julia',
    }

    FRAMEWORKS = {
        'react', 'angular', 'vue', 'vue.js', 'django', 'flask', 'fastapi',
        'spring', 'spring boot', 'express', 'express.js', 'next.js', 'nextjs',
        'nuxt', 'svelte', 'tensorflow', 'pytorch', 'keras', 'scikit-learn',
        'sklearn', 'pandas', 'numpy', 'langchain', 'langgraph', 'llamaindex',
        'hugging face', 'huggingface', 'bootstrap', 'tailwind', 'jquery',
        'node.js', 'nodejs', '.net', 'asp.net', 'rails', 'ruby on rails',
        'laravel', 'symfony', 'gin', 'fiber', 'actix', 'rocket',
        'xgboost', 'lightgbm', 'crewai', 'autogen', 'streamlit', 'gradio',
        'matplotlib', 'seaborn', 'plotly', 'opencv', 'spacy', 'nltk',
    }

    TOOLS = {
        'docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'google cloud',
        'terraform', 'ansible', 'jenkins', 'github actions', 'gitlab ci',
        'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence',
        'postman', 'swagger', 'grafana', 'prometheus', 'datadog',
        'tableau', 'power bi', 'powerbi', 'excel', 'vscode',
        'mongodb', 'postgresql', 'postgres', 'mysql', 'redis', 'elasticsearch',
        'kafka', 'rabbitmq', 'airflow', 'mlflow', 'dbt', 'snowflake',
        'bigquery', 'spark', 'pyspark', 'hadoop', 'hive',
        'pinecone', 'chroma', 'chromadb', 'faiss', 'milvus', 'weaviate',
        'linux', 'nginx', 'apache', 'ci/cd', 'cicd',
        'figma', 'sketch', 'photoshop', 'illustrator',
        'neo4j', 'dynamodb', 'firebase', 'supabase', 'vercel', 'heroku',
        'sagemaker', 'vertex ai', 'bedrock', 'databricks', 'nifi',
        'n8n', 'zapier', 'make', 'alteryx', 'dataiku',
    }

    SOFT_SKILLS = {
        'leadership', 'communication', 'teamwork', 'problem solving',
        'problem-solving', 'critical thinking', 'project management',
        'time management', 'mentoring', 'collaboration', 'presentation',
        'negotiation', 'conflict resolution', 'decision making',
        'strategic planning', 'agile', 'scrum', 'kanban',
        'stakeholder management', 'client management', 'team leadership',
    }

    def __init__(self, taxonomy=None):
        self.taxonomy = taxonomy

    def normalize_and_categorize(self, skills: List[Dict], full_text: str = "") -> Dict:
        """
        Normalize skills and categorize into:
        programming_languages, frameworks, tools, technical_skills, soft_skills, skill_proficiency
        """
        logger.info(f"[SkillNormalizer] Processing {len(skills)} skills...")

        categorized = {
            "programming_languages": [],
            "frameworks": [],
            "tools": [],
            "technical_skills": [],
            "soft_skills": [],
            "skill_proficiency": [],
        }
        seen = set()

        # Process LLM-extracted skills
        for s in skills:
            if not isinstance(s, dict):
                continue
            name = (s.get("name") or "").strip()
            if not name or len(name) < 2 or len(name) > 50:
                continue
            if name.lower() in seen:
                continue
            seen.add(name.lower())

            # Taxonomy match
            canonical_name = name
            taxonomy_category = None
            if self.taxonomy:
                entry = self.taxonomy.find_skill(name)
                if entry:
                    canonical_name = entry.name
                    taxonomy_category = entry.category
                    seen.add(entry.name.lower())

            # Categorize
            category = self._categorize(canonical_name, s.get("category"), taxonomy_category)
            categorized[category].append(canonical_name)

            # Proficiency entry
            proficiency = s.get("proficiency")
            years = s.get("years")
            if proficiency or years:
                level = proficiency or self._estimate_level(years)
                if level:
                    categorized["skill_proficiency"].append({
                        "skill": canonical_name,
                        "level": level,
                        "years": years,
                    })

        # Phase 2: Discover additional skills from full text via taxonomy
        if full_text and self.taxonomy:
            found = self.taxonomy.find_skills_in_text(full_text)
            for entry in found:
                if entry.name.lower() not in seen:
                    seen.add(entry.name.lower())
                    category = self._categorize(entry.name, None, entry.category)
                    categorized[category].append(entry.name)

        # Deduplicate each list
        for key in categorized:
            if isinstance(categorized[key], list) and categorized[key]:
                if isinstance(categorized[key][0], str):
                    categorized[key] = list(dict.fromkeys(categorized[key]))

        total = sum(len(v) for k, v in categorized.items() if k != "skill_proficiency")
        logger.info(f"[SkillNormalizer] Categorized: "
                     f"lang={len(categorized['programming_languages'])}, "
                     f"fw={len(categorized['frameworks'])}, "
                     f"tools={len(categorized['tools'])}, "
                     f"tech={len(categorized['technical_skills'])}, "
                     f"soft={len(categorized['soft_skills'])}, "
                     f"total={total}")
        return categorized

    def _categorize(self, name: str, llm_category: str = None,
                    taxonomy_category: str = None) -> str:
        """Determine which category a skill belongs to"""
        name_lower = name.lower().strip()

        # Direct set matching
        if name_lower in self.PROGRAMMING_LANGUAGES:
            return "programming_languages"
        if name_lower in self.FRAMEWORKS:
            return "frameworks"
        if name_lower in self.TOOLS:
            return "tools"
        if name_lower in self.SOFT_SKILLS:
            return "soft_skills"

        # Taxonomy category mapping
        cat = taxonomy_category or ""
        if cat in ('programming_language',):
            return "programming_languages"
        if cat in ('ml_framework', 'frontend', 'backend', 'api_framework'):
            return "frameworks"
        if cat in ('devops', 'cloud_platform', 'database', 'vector_database',
                    'data_engineering', 'visualization', 'mlops', 'containers'):
            return "tools"
        if cat in ('soft_skill', 'methodology'):
            return "soft_skills"

        # LLM category hint
        if llm_category:
            lc = llm_category.lower()
            if 'language' in lc or 'programming' in lc:
                return "programming_languages"
            if 'framework' in lc:
                return "frameworks"
            if 'tool' in lc:
                return "tools"
            if 'soft' in lc:
                return "soft_skills"

        return "technical_skills"

    def _estimate_level(self, years) -> Optional[str]:
        if years is None:
            return None
        try:
            y = int(years)
            if y <= 1:
                return "beginner"
            elif y <= 3:
                return "intermediate"
            elif y <= 6:
                return "advanced"
            else:
                return "expert"
        except (ValueError, TypeError):
            return None


# ============================================================================
# AGENT 5: REVIEWER
# ============================================================================

class ReviewerAgent:
    """Quality check on the final extraction."""

    def review(self, result: Dict) -> Dict:
        logger.info("[ReviewerAgent] Reviewing quality...")

        issues = []
        pi = result.get("personal_info", {})

        if not pi.get("full_name"):
            issues.append("Name not found")
        if not pi.get("contact", {}).get("email"):
            issues.append("Email not found")
        if not result.get("experience"):
            issues.append("No work experience found")
        if not result.get("education"):
            issues.append("No education found")

        skills = result.get("skills", {})
        total_skills = (len(skills.get("programming_languages", [])) +
                        len(skills.get("frameworks", [])) +
                        len(skills.get("tools", [])) +
                        len(skills.get("technical_skills", [])) +
                        len(skills.get("soft_skills", [])))
        if total_skills < 3:
            issues.append(f"Only {total_skills} skills found")

        # Confidence calculation
        score = 0.0
        if pi.get("full_name"):
            score += 0.2
        if pi.get("contact", {}).get("email"):
            score += 0.1
        if result.get("experience"):
            score += 0.3
        if total_skills >= 3:
            score += 0.2
        if result.get("education"):
            score += 0.2
        confidence = min(score, 1.0)

        review = {
            "is_complete": len(issues) == 0,
            "issues": issues,
            "needs_human_review": len(issues) > 1 or confidence < 0.7,
            "overall_confidence": round(confidence, 2),
            "stats": {
                "total_skills": total_skills,
                "experience_count": len(result.get("experience", [])),
                "education_count": len(result.get("education", [])),
                "certifications_count": len(result.get("certifications", [])),
                "projects_count": len(result.get("projects", [])),
            }
        }

        status = "✅ PASS" if review["is_complete"] else "⚠️ NEEDS REVIEW"
        logger.info(f"[ReviewerAgent] {status} | confidence={confidence:.2f} | "
                     f"skills={total_skills}, issues={len(issues)}")
        return review


# ============================================================================
# ORCHESTRATOR: RESUME PROCESSING GRAPH
# ============================================================================

class ResumeProcessingGraph:
    """
    Multi-agent resume parsing pipeline.

    Flow:
      Resume Text → ExtractorA (recall) + ExtractorB (precision)
                  → JudgeAgent (reconcile)
                  → SkillNormalizerAgent (taxonomy + categorize)
                  → ReviewerAgent (quality)
                  → Final JSON (matching user's schema)
    """

    def __init__(self, taxonomy=None, api_key: str = None, model: str = None):
        self.llm = GroqClient(api_key=api_key, model=model)
        self.extractor_a = ExtractorA(self.llm)
        self.extractor_b = ExtractorB(self.llm)
        self.judge = JudgeAgent(self.llm)
        self.normalizer = SkillNormalizerAgent(taxonomy)
        self.reviewer = ReviewerAgent()
        self.taxonomy = taxonomy
        logger.info("🚀 ResumeProcessingGraph initialized (5 agents)")

    def process(self, resume_text: str, source_file: str = "") -> Dict:
        """
        Process resume through full multi-agent pipeline.
        Returns Dict matching the target schema.
        """
        start_time = datetime.now()

        logger.info("=" * 50)
        logger.info("🚀 RESUME PROCESSING GRAPH - Starting")
        logger.info(f"   Text length: {len(resume_text)} chars")
        logger.info("=" * 50)

        # --- Step 1: ExtractorA (High Recall) ---
        logger.info("\n📝 Step 1/5: ExtractorA (High Recall)")
        extraction_a, confidence_a = self.extractor_a.extract(resume_text)

        # --- Step 2: ExtractorB (High Precision) ---
        logger.info("\n🔍 Step 2/5: ExtractorB (High Precision)")
        extraction_b, confidence_b = self.extractor_b.extract(resume_text)

        # --- Step 3: Judge (Reconcile) ---
        logger.info("\n⚖️ Step 3/5: JudgeAgent (Reconcile)")
        merged = self.judge.reconcile(
            extraction_a, confidence_a,
            extraction_b, confidence_b,
            resume_text
        )

        # --- Step 4: Skill Normalization + Categorization ---
        logger.info("\n🏷️ Step 4/5: SkillNormalizer (Taxonomy + Categorize)")
        raw_skills = merged.get("skills", [])
        categorized_skills = self.normalizer.normalize_and_categorize(raw_skills, resume_text)
        merged["skills"] = categorized_skills

        # --- Step 5: Reviewer ---
        logger.info("\n🔍 Step 5/5: ReviewerAgent (Quality)")
        review = self.reviewer.review(merged)

        # --- Build final output with meta ---
        duration = (datetime.now() - start_time).total_seconds()
        merged["meta"] = {
            "source_file": source_file,
            "parser_version": "multi-agent-v1.0",
            "parsed_date": datetime.utcnow().isoformat(),
            "agents_used": ["ExtractorA", "ExtractorB", "JudgeAgent",
                            "SkillNormalizer", "ReviewerAgent"],
            "confidence_a": confidence_a,
            "confidence_b": confidence_b,
            "overall_confidence": review["overall_confidence"],
            "duration_seconds": round(duration, 2),
            "review": review,
        }

        logger.info(f"\n{'='*50}")
        logger.info(f"✅ RESUME PROCESSING COMPLETE in {duration:.1f}s")
        logger.info(f"   Name: {merged.get('personal_info', {}).get('full_name')}")
        logger.info(f"   Skills: {review['stats']['total_skills']}")
        logger.info(f"   Experience: {review['stats']['experience_count']}")
        logger.info(f"   Education: {review['stats']['education_count']}")
        logger.info(f"   Confidence: {review['overall_confidence']}")
        logger.info(f"{'='*50}")

        return merged
