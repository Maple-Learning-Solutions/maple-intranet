import os
import zipfile
import shutil
import uuid
from pathlib import Path
import xml.etree.ElementTree as ET

MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB

def is_safe_path(base, target):
    """Ensure the target path is inside the base path to prevent Zip Slip."""
    base = Path(base).resolve()
    target = (base / target).resolve()
    return base in target.parents

class ScormExtractor:
    def __init__(self, upload_dir: str = "static/scorm"):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def extract_package(self, zip_filepath: str) -> dict:
        """
        Extracts a SCORM package securely and parses imsmanifest.xml.
        Returns metadata including the launch URL.
        """
        if os.path.getsize(zip_filepath) > MAX_UPLOAD_SIZE:
            raise ValueError("SCORM package exceeds maximum allowed size.")

        package_id = str(uuid.uuid4())
        package_dir = self.upload_dir / package_id
        package_dir.mkdir(parents=True, exist_ok=True)

        try:
            with zipfile.ZipFile(zip_filepath, 'r') as zip_ref:
                # 1. Security Check: Zip Slip
                for member in zip_ref.namelist():
                    if not is_safe_path(package_dir, member):
                        raise ValueError(f"Malicious file path detected in ZIP: {member}")

                # 2. Extract
                zip_ref.extractall(package_dir)

            # 3. Find imsmanifest.xml
            manifest_path = package_dir / "imsmanifest.xml"
            launch_file = None
            
            if manifest_path.exists():
                # 4. Parse XML to find the launch file (SCO)
                launch_file = self._parse_manifest_for_launch_file(manifest_path)
            
            if not launch_file:
                # Fallback to index.html if it exists
                if (package_dir / "index.html").exists():
                    launch_file = "index.html"
                else:
                    raise ValueError("Not a valid SCORM package: Missing imsmanifest.xml or index.html.")

            return {
                "package_id": package_id,
                "entry_point_url": f"/static/scorm/{package_id}/{launch_file}",
                "local_path": str(package_dir)
            }
        except Exception as e:
            # Cleanup on failure
            if package_dir.exists():
                shutil.rmtree(package_dir)
            raise e

    def _parse_manifest_for_launch_file(self, manifest_path: Path) -> str:
        """Extracts the href of the default resource from imsmanifest.xml."""
        try:
            tree = ET.parse(manifest_path)
            root = tree.getroot()
            
            # Find the default namespace which is usually something like http://www.imsglobal.org/xsd/imscp_v1p1
            # We will use iter() to bypass namespace issues for simplicity
            
            # 1. Find organizations -> organization -> item
            # The item's identifierref points to a resource
            item_ref = None
            for item in root.iter():
                if item.tag.endswith('item'):
                    item_ref = item.attrib.get('identifierref')
                    if item_ref:
                        break
            
            if not item_ref:
                return None

            # 2. Find the resource matching the identifierref
            for resource in root.iter():
                if resource.tag.endswith('resource'):
                    if resource.attrib.get('identifier') == item_ref:
                        return resource.attrib.get('href')

            return None
        except Exception:
            return None
