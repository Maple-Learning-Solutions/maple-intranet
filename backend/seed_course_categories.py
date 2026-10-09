import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.learning import CourseCategory
from sqlalchemy import select, insert

async def seed_course_categories():
    categories = [
        {"id": 1, "name": "Company Onboarding", "color_tag": "blue"},
        {"id": 2, "name": "Technical Training", "color_tag": "green"},
        {"id": 3, "name": "Soft Skills", "color_tag": "yellow"},
        {"id": 4, "name": "Compliance", "color_tag": "red"}
    ]

    async with AsyncSessionLocal() as db:
        for cat in categories:
            result = await db.execute(select(CourseCategory).where(CourseCategory.id == cat["id"]))
            existing = result.scalars().first()
            
            if not existing:
                new_cat = CourseCategory(
                    id=cat["id"],
                    name=cat["name"],
                    color_tag=cat["color_tag"]
                )
                db.add(new_cat)
        
        await db.commit()
        print("Course categories seeded successfully.")

if __name__ == "__main__":
    asyncio.run(seed_course_categories())
