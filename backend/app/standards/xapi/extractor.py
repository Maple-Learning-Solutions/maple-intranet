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

class XapiExtractor:
    def __init__(self, upload_dir: str = "static/xapi"):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def extract(self, zip_filepath: str, package_id: str) -> dict:
        if os.path.getsize(zip_filepath) > MAX_UPLOAD_SIZE:
            raise ValueError("xAPI package exceeds maximum allowed size.")

        package_dir = self.upload_dir / package_id
        package_dir.mkdir(parents=True, exist_ok=True)

        try:
            with zipfile.ZipFile(zip_filepath, 'r') as zip_ref:
                for member in zip_ref.namelist():
                    if not is_safe_path(package_dir, member):
                        raise ValueError(f"Malicious file path detected in ZIP: {member}")
                zip_ref.extractall(package_dir)

            tincan_path = package_dir / "tincan.xml"
            launch_file = None
            
            if tincan_path.exists():
                launch_file = self._parse_tincan_for_launch_file(tincan_path)
            
            if not launch_file:
                if (package_dir / "index.html").exists():
                    launch_file = "index.html"
                else:
                    raise ValueError("Not a valid xAPI package: Missing tincan.xml or index.html.")

            return {
                "package_id": package_id,
                "entry_point_url": f"/static/xapi/{package_id}/{launch_file}",
                "local_path": str(package_dir),
                "launch_file": launch_file
            }
        except Exception as e:
            if package_dir.exists():
                shutil.rmtree(package_dir)
            raise e

    def _parse_tincan_for_launch_file(self, tincan_path: Path) -> str:
        try:
            tree = ET.parse(tincan_path)
            root = tree.getroot()
            
            for activity in root.iter():
                if activity.tag.endswith('activity'):
                    launch = activity.find('{http://projecttincan.com/tincan.xsd}launch')
                    if launch is not None and launch.text:
                        return launch.text.strip()
                    
                    # Try without namespace
                    launch_no_ns = activity.find('launch')
                    if launch_no_ns is not None and launch_no_ns.text:
                        return launch_no_ns.text.strip()
                        
            return None
        except Exception:
            return None
