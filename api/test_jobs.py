
import sys
sys.path.insert(0, '.')
from app.services.database import SessionLocal
from app.models.job import Job, JobSkill
from app.models.skill import Skill
from sqlalchemy import select
db = SessionLocal()
jobs = db.query(Job).order_by(Job.title).all()
for j in jobs:
    count = db.query(JobSkill).filter(JobSkill.job_id == j.id).count()
    print(f'{j.title} | {j.company_name} | {count} skills')
db.close()

