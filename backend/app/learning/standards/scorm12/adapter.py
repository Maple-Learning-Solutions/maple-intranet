import re
from typing import Dict, Any, Optional

class Scorm12Adapter:
    """
    Handles SCORM 1.2 CMI data model translations and business rules.
    """
    
    @staticmethod
    def get_initial_cmi(student_id: str, student_name: str) -> Dict[str, str]:
        """Returns the default SCORM 1.2 CMI data model required for initialization."""
        return {
            "cmi.core.student_id": student_id,
            "cmi.core.student_name": student_name,
            "cmi.core.lesson_location": "",
            "cmi.core.lesson_status": "not attempted",
            "cmi.core.score.raw": "",
            "cmi.core.score.min": "",
            "cmi.core.score.max": "",
            "cmi.core.session_time": "00:00:00",
            "cmi.core.total_time": "00:00:00",
            "cmi.suspend_data": "",
            "cmi.core.exit": "",
            "cmi.core.lesson_mode": "normal",
            "cmi.core.credit": "credit",
        }

    @staticmethod
    def generate_learning_event(cmi_data: Dict[str, str], attempt) -> Any:
        from app.learning.events import LearningEvent
        from datetime import datetime, timezone
        import uuid
        
        lesson_status = cmi_data.get("cmi.core.lesson_status", "incomplete")
        
        event_type = "progress"
        if lesson_status in ["completed", "passed", "failed"]:
            event_type = lesson_status
        elif lesson_status == "not attempted":
            event_type = "initialized"
            
        progress_pct = 100 if event_type in ["completed", "passed"] else None
        
        score_raw = cmi_data.get("cmi.core.score.raw")
        try:
            score_float = float(score_raw) if score_raw and str(score_raw).strip() else None
        except ValueError:
            score_float = None
            
        total_time_str = cmi_data.get("cmi.core.total_time", "")
        duration_sec = int(Scorm12Adapter._parse_time(total_time_str)) if total_time_str else 0
            
        # Extract interactions
        interactions = {}
        for key, value in cmi_data.items():
            if key.startswith("cmi.interactions."):
                parts = key.split(".")
                if len(parts) >= 4:
                    try:
                        idx = int(parts[2])
                        prop = ".".join(parts[3:])
                        if idx not in interactions:
                            interactions[idx] = {}
                        interactions[idx][prop] = value
                    except ValueError:
                        pass
                        
        metadata = {}
        if interactions:
            metadata["interactions"] = [interactions[i] for i in sorted(interactions.keys())]

        return LearningEvent(
            user_id=attempt.user_id,
            course_id=attempt.course_id,
            package_id=attempt.package_id,
            attempt_id=attempt.id,
            activity_id=None,
            event_type=event_type,
            progress_percent=progress_pct,
            completion_status=lesson_status,
            success_status="passed" if lesson_status == "passed" else ("failed" if lesson_status == "failed" else None),
            score_raw=score_float,
            duration_seconds=duration_sec,
            location=cmi_data.get("cmi.core.lesson_location"),
            timestamp=datetime.now(timezone.utc),
            source_standard="SCORM_1_2",
            source_event_id=str(uuid.uuid4()),
            metadata=metadata
        )

    @staticmethod
    def _parse_time(time_str: str) -> float:
        """Parses SCORM 1.2 time (HHHH:MM:SS.SS) into seconds."""
        if not time_str:
            return 0.0
        match = re.match(r'^(\d{2,4}):(\d{2}):(\d{2}(?:\.\d+)?)$', time_str.strip())
        if not match:
            return 0.0
        h, m, s = match.groups()
        return (int(h) * 3600) + (int(m) * 60) + float(s)

    @staticmethod
    def _format_time(seconds: float) -> str:
        """Formats seconds back into SCORM 1.2 time (HHHH:MM:SS.SS)."""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = seconds % 60
        # If no fractional seconds, format without decimal
        if s.is_integer():
            return f"{h:04d}:{m:02d}:{int(s):02d}"
        return f"{h:04d}:{m:02d}:{s:05.2f}"

    @staticmethod
    def calculate_total_time(total_time_str: str, session_time_str: str) -> str:
        """
        Adds current session_time to total_time per SCORM 1.2 rules.
        """
        total_sec = Scorm12Adapter._parse_time(total_time_str)
        session_sec = Scorm12Adapter._parse_time(session_time_str)
        return Scorm12Adapter._format_time(total_sec + session_sec)
        
    @staticmethod
    def extract_state_columns(cmi_data: Dict[str, str]) -> Dict[str, Any]:
        """
        Extracts strongly typed columns from the raw CMI JSON for ScormRuntimeState.
        """
        score_raw = cmi_data.get("cmi.core.score.raw")
        score_min = cmi_data.get("cmi.core.score.min")
        score_max = cmi_data.get("cmi.core.score.max")
        
        def safe_float(val):
            if val and str(val).strip():
                try: return float(val)
                except: return None
            return None
            
        return {
            "lesson_status": cmi_data.get("cmi.core.lesson_status"),
            "lesson_location": cmi_data.get("cmi.core.lesson_location"),
            "suspend_data": cmi_data.get("cmi.suspend_data"),
            "score_raw": safe_float(score_raw),
            "score_min": safe_float(score_min),
            "score_max": safe_float(score_max),
            "session_time": cmi_data.get("cmi.core.session_time"),
            "total_time": cmi_data.get("cmi.core.total_time"),
            "lesson_mode": cmi_data.get("cmi.core.lesson_mode"),
            "credit": cmi_data.get("cmi.core.credit"),
            "entry": cmi_data.get("cmi.core.entry"),
            "exit": cmi_data.get("cmi.core.exit"),
        }
