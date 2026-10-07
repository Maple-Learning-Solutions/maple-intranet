import os
import shutil
import tempfile
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.learning import LearningPackage
from app.learning.enums import PackageStandard
from app.learning.services.package_detector import PackageDetector
from app.standards.scorm.scorm12.extractor import Scorm12Extractor

from app.api.deps import require_admin

router = APIRouter(dependencies=[Depends(require_admin)])
detector = PackageDetector()

@router.post("/upload")
async def upload_learning_package(
    title: str = Form(...),
    version: str = Form("1.0"),
    declared_standard: str = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only .zip files are allowed")

    temp_fd, temp_path = tempfile.mkstemp(suffix=".zip")
    try:
        await file.seek(0)
        with os.fdopen(temp_fd, "wb") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
        
        detected_std = detector.detect(temp_path)
        
        if detected_std == PackageStandard.UNKNOWN:
            raise HTTPException(status_code=400, detail="Unsupported package format")

        import uuid
        pkg_id = str(uuid.uuid4())
        
        result = {}
        if detected_std == PackageStandard.SCORM_1_2:
            from app.standards.scorm.scorm12.extractor import Scorm12Extractor
            extractor = Scorm12Extractor()
            result = extractor.extract(temp_path, pkg_id)
            
        elif detected_std == PackageStandard.SCORM_2004:
            from app.standards.scorm.scorm2004.extractor import Scorm2004Extractor
            extractor = Scorm2004Extractor()
            result = extractor.extract(temp_path, pkg_id)
            
        elif detected_std == PackageStandard.XAPI:
            from app.standards.xapi.extractor import XapiExtractor
            extractor = XapiExtractor()
            result = extractor.extract(temp_path, pkg_id)
            
        elif detected_std == PackageStandard.CMI5:
            from app.standards.cmi5.extractor import Cmi5Extractor
            extractor = Cmi5Extractor()
            result = extractor.extract(temp_path, pkg_id)

        # Upload to Supabase Storage
        from app.learning.services.storage import SupabaseStorageService
        storage_service = SupabaseStorageService()
        storage_base_path = f"scorm/{pkg_id}/v1"
        
        if "local_path" in result:
            storage_service.upload_directory(result["local_path"], storage_base_path)
            
            # Clean up local extracted files after successful upload
            if os.path.exists(result["local_path"]):
                shutil.rmtree(result["local_path"])

        launch_file = result.get("launch_file", "")
        entry_point_url = storage_service.get_public_url(f"{storage_base_path}/{launch_file}") if launch_file else ""

        # Using detected standard as the active standard
        package = LearningPackage(
            title=title,
            version=version,
            standard=detected_std.value,
            detected_standard=detected_std.value,
            declared_standard=declared_standard,
            standard_version="1.2" if detected_std == PackageStandard.SCORM_1_2 else "Unknown",
            entry_point_url=entry_point_url,
            storage_provider="supabase",
            storage_bucket=storage_service.bucket_name,
            storage_path=storage_base_path,
            storage_version="v1",
            launch_file=launch_file,
            package_version=1,
            uploaded_by="temp_admin_user" # Mocked for now
        )
        db.add(package)
        await db.commit()
        await db.refresh(package)
        
        return {"id": package.id, "title": package.title, "standard": package.standard, "entry_point_url": package.entry_point_url}

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Internal server error: {repr(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
