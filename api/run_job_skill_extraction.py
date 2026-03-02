"""
Job Skill Extraction Runner
=============================
Processes all jobs in the database using the multi-agent pipeline:
  1. SkillExtractorAgent (Groq LLM)
  2. TaxonomyMatcherAgent (O*NET + ESCO + Custom)
  3. RequirementClassifierAgent

Location: job-recommendation-engine/api/run_job_skill_extraction.py

Usage:
  cd job-recommendation-engine/api
  python run_job_skill_extraction.py              # Process jobs with 0 skills
  python run_job_skill_extraction.py --all        # Process ALL jobs
  python run_job_skill_extraction.py --job-id X   # Process specific job
"""

import sys
import os
import logging
import argparse
from datetime import datetime

# Setup path - ensures we can import from app.*
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Default paths relative to api/ folder
# ------------------------------------------------------------------
DEFAULT_CUSTOM_SKILLS = os.path.join("data", "custom", "custom_skills.json")
DEFAULT_ONET_SKILLS = os.path.join("data", "onet", "Technology_Skills.txt")
DEFAULT_ESCO_SKILLS = os.path.join("data", "esco", "skills_en.csv")


def main():
    parser = argparse.ArgumentParser(description='Extract skills from job descriptions')
    parser.add_argument('--all', action='store_true', help='Process ALL jobs (not just empty ones)')
    parser.add_argument('--job-id', type=str, help='Process a specific job by ID')
    parser.add_argument('--custom-skills', type=str, default=DEFAULT_CUSTOM_SKILLS,
                        help='Path to custom_skills.json')
    parser.add_argument('--onet-skills', type=str, default=DEFAULT_ONET_SKILLS,
                        help='Path to Technology_Skills.txt')
    parser.add_argument('--esco-skills', type=str, default=DEFAULT_ESCO_SKILLS,
                        help='Path to skills_en.csv')
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("🚀 JOB SKILL EXTRACTION - Multi-Agent Pipeline")
    print("=" * 60)

    # ------------------------------------------------------------------
    # 1. Load Skill Taxonomy
    # ------------------------------------------------------------------
    print("\n📚 Loading skill taxonomy...")
    from app.agents.skill_taxonomy import SkillTaxonomyManager

    taxonomy = SkillTaxonomyManager()
    taxonomy.load_all_sources(
        onet_path=args.onet_skills,
        esco_path=args.esco_skills,
        custom_path=args.custom_skills,
    )
    stats = taxonomy.get_stats()
    print(f"   ✅ {stats['total_skills']} skills loaded from {stats['sources']}")

    # ------------------------------------------------------------------
    # 2. Initialize Multi-Agent Pipeline
    # ------------------------------------------------------------------
    print("\n🤖 Initializing agents...")
    from app.agents.job_skill_extractor import JobProcessingGraph

    pipeline = JobProcessingGraph(taxonomy=taxonomy)
    print("   ✅ SkillExtractorAgent (Groq LLM)")
    print("   ✅ TaxonomyMatcherAgent (O*NET + ESCO + Custom)")
    print("   ✅ RequirementClassifierAgent")

    # ------------------------------------------------------------------
    # 3. Load Jobs from Database
    # ------------------------------------------------------------------
    print("\n📦 Loading jobs from database...")
    from app.services.database import SessionLocal
    from app.models.job import Job, JobSkill
    from app.models.skill import Skill
    from sqlalchemy import select, func

    db = SessionLocal()

    try:
        if args.job_id:
            # Process specific job
            jobs_query = db.query(Job).filter(Job.id == args.job_id).all()
        elif args.all:
            # Process all jobs
            jobs_query = db.query(Job).filter(Job.is_active == True).order_by(Job.title).all()
        else:
            # Only process jobs with 0 skills
            subq = db.query(JobSkill.job_id).group_by(JobSkill.job_id).subquery()
            jobs_query = db.query(Job).filter(
                Job.is_active == True,
                ~Job.id.in_(select(subq.c.job_id))
            ).order_by(Job.title).all()

        jobs_to_process = []
        for job in jobs_query:
            existing_count = db.query(func.count(JobSkill.id)).filter(
                JobSkill.job_id == job.id
            ).scalar()
            jobs_to_process.append({
                'id': job.id,
                'title': job.title,
                'company': job.company_name,
                'description': job.description_raw or job.description_clean or '',
                'existing_skills': existing_count
            })

        print(f"   Found {len(jobs_to_process)} jobs to process:")
        for j in jobs_to_process:
            status = f"({j['existing_skills']} existing skills)" if j['existing_skills'] > 0 else "(NO skills ❌)"
            desc_status = f"{len(j['description'])} chars" if j['description'] else "NO description"
            print(f"   • {j['title']} | {j['company']} | {status} | {desc_status}")

        if not jobs_to_process:
            print("\n✅ All jobs already have skills. Use --all to reprocess.")
            return

        # ------------------------------------------------------------------
        # 4. Process Jobs Through Multi-Agent Pipeline
        # ------------------------------------------------------------------
        print(f"\n{'='*60}")
        print(f"🔄 Processing {len(jobs_to_process)} jobs...")
        print(f"{'='*60}")

        start_time = datetime.now()
        results = pipeline.process_all_jobs(jobs_to_process)

        # ------------------------------------------------------------------
        # 5. Save Results to Database
        # ------------------------------------------------------------------
        print(f"\n{'='*60}")
        print(f"💾 Saving extracted skills to database...")
        print(f"{'='*60}")

        from app.agents.job_skill_extractor import save_skills_to_db

        total_saved = 0
        for result in results:
            if result.skills_extracted:
                print(f"\n  📋 {result.job_title} @ {result.company}:")
                for skill in result.skills_extracted:
                    marker = "🔷" if skill.source == 'both' else "🔶" if skill.source == 'llm' else "🔵"
                    print(f"     {marker} {skill.canonical_name or skill.name} "
                          f"[{skill.requirement_type}] "
                          f"({skill.category}) "
                          f"conf={skill.confidence:.2f}")

                saved = save_skills_to_db(db, result, Skill, JobSkill)
                total_saved += saved
            else:
                print(f"\n  ⚠️ {result.job_title}: No skills extracted")
                if result.errors:
                    for err in result.errors:
                        print(f"     ❌ {err}")

        # ------------------------------------------------------------------
        # 6. Summary
        # ------------------------------------------------------------------
        duration = (datetime.now() - start_time).total_seconds()

        print(f"\n{'='*60}")
        print(f"✅ EXTRACTION COMPLETE")
        print(f"{'='*60}")
        print(f"  📊 Jobs processed: {len(results)}")
        print(f"  🛠️  Total skills extracted: {sum(r.skills_merged for r in results)}")
        print(f"  💾 New job-skill links: {total_saved}")
        print(f"  ⏱️  Duration: {duration:.1f}s")
        print(f"  📈 Avg skills/job: {sum(r.skills_merged for r in results) / max(len(results), 1):.1f}")

        # Verify
        print(f"\n📋 Verification:")
        for job in db.query(Job).order_by(Job.title).all():
            count = db.query(func.count(JobSkill.id)).filter(JobSkill.job_id == job.id).scalar()
            status = "✅" if count > 0 else "❌"
            print(f"  {status} {job.title} | {job.company_name} | {count} skills")

    finally:
        db.close()


if __name__ == "__main__":
    main()