import asyncio
from app.learning.services.package_detector import PackageDetector
from app.learning.enums import PackageStandard

async def test_extract():
    detector = PackageDetector()
    path = "test_scorm2004.zip"
    detected_std = detector.detect(path)
    print("Detected standard:", detected_std)
    
    pkg_id = "test_pkg_123"
    try:
        from app.standards.scorm.scorm2004.extractor import Scorm2004Extractor
        extractor = Scorm2004Extractor()
        result = extractor.extract(path, pkg_id)
        print("Extract result:", result)
        
        from app.learning.services.storage import SupabaseStorageService
        storage_service = SupabaseStorageService()
        storage_base_path = f"scorm/{pkg_id}/v1"
        storage_service.upload_directory(result["local_path"], storage_base_path)
        print("Uploaded to supabase")
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(test_extract())
