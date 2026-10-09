import os
import shutil
import tempfile
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.learning import LearningPackage, Cmi5AssignableUnit
from app.learning.repositories.package_repository import PackageRepository
from app.api.deps import require_admin

router = APIRouter()
package_repo = PackageRepository()

@router.post("/upload")
async def upload_scorm_package(
    title: str = Form(...),
    version: str = Form("1.0"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_admin)
):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only .zip files are allowed")

    # Save uploaded file temporarily
    temp_fd, temp_path = tempfile.mkstemp(suffix=".zip")
    try:
        with os.fdopen(temp_fd, "wb") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
        
        # Extract and parse via unified repository
        result = package_repo.extract_and_detect(temp_path)
        
        # Save metadata to DB
        package = LearningPackage(
            title=title,
            version=version,
            standard=result["package_type"].upper(),
            standard_version="1.2" if result["package_type"] == "scorm_1_2" else "2004" if result["package_type"] == "scorm_2004" else "1.0",
            package_type=result["package_type"],
            manifest_path=result.get("manifest_path", ""),
            package_hash=result.get("package_hash", ""),
            entry_point_url=result["entry_point_url"],
            uploaded_by=current_user.id
        )
        db.add(package)
        await db.commit()
        await db.refresh(package)
        
        # Persist CMI5 AUs if metadata exists
        cmi5_meta = result.get("cmi5_metadata")
        if cmi5_meta and "aus" in cmi5_meta:
            for au_data in cmi5_meta["aus"]:
                db_au = Cmi5AssignableUnit(
                    package_id=package.id,
                    au_id=au_data.get("id", ""),
                    title=au_data.get("title", "AU"),
                    launch_method=au_data.get("launchMethod", "AnyWindow"),
                    move_on=au_data.get("moveOn", "CompletedAndPassed"),
                    mastery_score=au_data.get("masteryScore")
                )
                db.add(db_au)
            await db.commit()
        
        return {"id": package.id, "title": package.title, "entry_point_url": package.entry_point_url}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error during extraction.")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
