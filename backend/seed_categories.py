import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.document import DocumentCategory
from sqlalchemy import select

async def seed_categories():
    categories = [
        {"main_category": "OFFICIAL", "name": "ONBOARDING", "description": "Onboarding Documents"},
        {"main_category": "OFFICIAL", "name": "TEAMS_DEPARTMENTS", "description": "Teams & Departments"},
        {"main_category": "OFFICIAL", "name": "ANNOUNCEMENTS_UPDATES", "description": "Announcements & Updates"},
        {"main_category": "OPERATIONAL", "name": "SOPS", "description": "SOPs"},
        {"main_category": "OPERATIONAL", "name": "WORKFLOWS", "description": "Workflows"}
    ]

    async with AsyncSessionLocal() as db:
        for cat in categories:
            result = await db.execute(
                select(DocumentCategory).where(
                    DocumentCategory.main_category == cat["main_category"],
                    DocumentCategory.name == cat["name"]
                )
            )
            existing = result.scalars().first()
            if not existing:
                new_cat = DocumentCategory(
                    main_category=cat["main_category"],
                    name=cat["name"],
                    description=cat["description"],
                    is_system=True
                )
                db.add(new_cat)
        
        await db.commit()
        print("Categories seeded successfully.")

if __name__ == "__main__":
    asyncio.run(seed_categories())
