import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.core import Department
from sqlalchemy import select

async def add_departments():
    departments_to_add = ["HR", "eLearning", "Sales", "Marketing", "Web Development"]
    
    async with AsyncSessionLocal() as db:
        for name in departments_to_add:
            # Check if department exists
            result = await db.execute(select(Department).where(Department.name == name))
            dept = result.scalars().first()
            if not dept:
                dept = Department(name=name)
                db.add(dept)
                print(f"Added department: {name}")
            else:
                print(f"Department already exists: {name}")
                
        await db.commit()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(add_departments())
