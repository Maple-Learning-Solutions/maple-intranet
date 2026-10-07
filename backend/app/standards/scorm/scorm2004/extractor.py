import os
import zipfile
import shutil
from pathlib import Path
import xml.etree.ElementTree as ET

MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB

def is_safe_path(base, target):
    base = Path(base).resolve()
    target = (base / target).resolve()
    return base in target.parents

class Scorm2004Extractor:
    def __init__(self, upload_dir: str = "static/scorm"):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def extract(self, zip_filepath: str, package_id: str) -> dict:
        if os.path.getsize(zip_filepath) > MAX_UPLOAD_SIZE:
            raise ValueError("SCORM package exceeds maximum allowed size.")

        package_dir = self.upload_dir / package_id
        package_dir.mkdir(parents=True, exist_ok=True)

        try:
            with zipfile.ZipFile(zip_filepath, 'r') as zip_ref:
                for member in zip_ref.namelist():
                    if not is_safe_path(package_dir, member):
                        raise ValueError(f"Malicious file path detected in ZIP: {member}")
                zip_ref.extractall(package_dir)

            manifest_path = package_dir / "imsmanifest.xml"
            launch_file = None
            
            if manifest_path.exists():
                launch_file = self._parse_manifest_for_launch_file(manifest_path)
            
            if not launch_file:
                if (package_dir / "index.html").exists():
                    launch_file = "index.html"
                else:
                    raise ValueError("Not a valid SCORM 2004 package: Missing imsmanifest.xml or index.html.")

            return {
                "package_id": package_id,
                "entry_point_url": f"/static/scorm/{package_id}/{launch_file}",
                "local_path": str(package_dir),
                "launch_file": launch_file
            }
        except Exception as e:
            if package_dir.exists():
                shutil.rmtree(package_dir)
            raise e

    def _parse_manifest_for_launch_file(self, manifest_path: Path) -> str:
        try:
            tree = ET.parse(manifest_path)
            root = tree.getroot()
            
            item_ref = None
            for item in root.iter():
                if item.tag.endswith('item'):
                    item_ref = item.attrib.get('identifierref')
                    if item_ref:
                        break
            
            if not item_ref:
                return None

            for resource in root.iter():
                if resource.tag.endswith('resource'):
                    if resource.attrib.get('identifier') == item_ref:
                        return resource.attrib.get('href')

            return None
        except Exception:
            return None
