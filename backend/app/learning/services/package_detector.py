import os
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional

from app.learning.enums import PackageStandard

class PackageDetector:
    """Service to detect the learning standard of an uploaded ZIP package."""

    def detect(self, zip_filepath: str) -> PackageStandard:
        """
        Inspects the ZIP file to determine if it is SCORM 1.2, SCORM 2004, xAPI, or cmi5.
        """
        if not zipfile.is_zipfile(zip_filepath):
            raise ValueError("Uploaded file is not a valid zip file or is corrupted.")

        try:
            with zipfile.ZipFile(zip_filepath, 'r') as zip_ref:
                files = zip_ref.namelist()
                
                has_cmi5 = any(f.lower().endswith('cmi5.xml') for f in files)
                has_xapi = any(f.lower().endswith('tincan.xml') for f in files)
                has_scorm = any(f.lower().endswith('imsmanifest.xml') for f in files)

                if has_cmi5:
                    return PackageStandard.CMI5
                
                # Many SCORM 1.2/2004 packages also contain a tincan.xml fallback driver.
                # Prioritize SCORM detection if imsmanifest.xml exists.
                if has_scorm:
                    manifest_path = next(f for f in files if f.lower().endswith('imsmanifest.xml'))
                    return self._detect_scorm_version(zip_ref, manifest_path)
                    
                if has_xapi:
                    return PackageStandard.XAPI
                
        except Exception as e:
            print(f"Exception during package detection: {e}")
            raise ValueError(f"Could not read zip file: {e}")
            
        file_names = files[:10] if 'files' in locals() else 'None'
        raise ValueError(f"No imsmanifest.xml or cmi5.xml found. Files in zip: {file_names}")

    def _detect_scorm_version(self, zip_ref: zipfile.ZipFile, manifest_path: str = 'imsmanifest.xml') -> PackageStandard:
        """Parses imsmanifest.xml to differentiate SCORM 1.2 and SCORM 2004."""
        try:
            with zip_ref.open(manifest_path) as manifest_file:
                tree = ET.parse(manifest_file)
                root = tree.getroot()
                
                # Check for schema version
                for elem in root.iter():
                    if elem.tag.endswith('schemaversion'):
                        version = elem.text.strip().lower() if elem.text else ""
                        if '2004' in version or '1.3' in version or '1.4' in version:
                            return PackageStandard.SCORM_2004
                        if '1.2' in version:
                            return PackageStandard.SCORM_1_2
                            
                # Fallback: assume 1.2 if standard schema is missing but manifest exists
                return PackageStandard.SCORM_1_2
        except Exception:
            # If parsing fails but it has imsmanifest, we'll try 1.2 as a fallback
            return PackageStandard.SCORM_1_2
