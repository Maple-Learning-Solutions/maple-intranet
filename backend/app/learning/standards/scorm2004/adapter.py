from typing import Dict, Any, Optional

class Scorm2004Adapter:
    """
    Handles SCORM 2004 CMI data model translations and business rules.
    """
    
    @staticmethod
    def get_initial_cmi(learner_id: str, learner_name: str) -> Dict[str, str]:
        """Returns the default SCORM 2004 CMI data model required for initialization."""
        return {
            "cmi.learner_id": learner_id,
            "cmi.learner_name": learner_name,
            "cmi.location": "",
            "cmi.completion_status": "unknown",
            "cmi.success_status": "unknown",
            "cmi.score.raw": "",
            "cmi.score.min": "",
            "cmi.score.max": "",
            "cmi.score.scaled": "",
            "cmi.session_time": "PT0H0M0S",
            "cmi.total_time": "PT0H0M0S",
            "cmi.suspend_data": "",
            "cmi.exit": "",
            "cmi.entry": "ab-initio",
            "cmi.mode": "normal",
            "cmi.credit": "credit",
        }

    @staticmethod
    def _parse_iso8601_duration(duration_str: str) -> float:
        """Parses SCORM 2004 ISO 8601 duration (e.g., PT1H30M) into seconds."""
        if not duration_str:
            return 0.0
        import isodate
        try:
            return isodate.parse_duration(duration_str).total_seconds()
        except:
            return 0.0

    @staticmethod
    def _format_iso8601_duration(seconds: float) -> str:
        """Formats seconds back into SCORM 2004 ISO 8601 duration."""
        import isodate
        import datetime
        return isodate.duration_isoformat(datetime.timedelta(seconds=seconds))

    @staticmethod
    def calculate_total_time(total_time_str: str, session_time_str: str) -> str:
        """Adds current session_time to total_time per SCORM 2004 rules."""
        total_sec = Scorm2004Adapter._parse_iso8601_duration(total_time_str)
        session_sec = Scorm2004Adapter._parse_iso8601_duration(session_time_str)
        return Scorm2004Adapter._format_iso8601_duration(total_sec + session_sec)

    @staticmethod
    def extract_state_columns(cmi_data: Dict[str, str]) -> Dict[str, Any]:
        """Extracts strongly typed columns from the raw CMI JSON for ScormRuntimeState (SCORM 2004)."""
        score_raw = cmi_data.get("cmi.score.raw")
        score_min = cmi_data.get("cmi.score.min")
        score_max = cmi_data.get("cmi.score.max")
        
        def safe_float(val):
            if val and str(val).strip():
                try: return float(val)
                except: return None
            return None
            
        return {
            "lesson_status": cmi_data.get("cmi.completion_status"),
            "lesson_location": cmi_data.get("cmi.location"),
            "suspend_data": cmi_data.get("cmi.suspend_data"),
            "score_raw": safe_float(score_raw),
            "score_min": safe_float(score_min),
            "score_max": safe_float(score_max),
            "session_time": cmi_data.get("cmi.session_time"),
            "total_time": cmi_data.get("cmi.total_time"),
            "lesson_mode": cmi_data.get("cmi.mode"),
            "credit": cmi_data.get("cmi.credit"),
            "entry": cmi_data.get("cmi.entry"),
            "exit": cmi_data.get("cmi.exit"),
        }

    @staticmethod
    def generate_learning_event(cmi_data: Dict[str, str], attempt) -> Any:
        from app.learning.events import LearningEvent
        from datetime import datetime, timezone
        import uuid
        
        completion_status = cmi_data.get("cmi.completion_status", "unknown")
        success_status = cmi_data.get("cmi.success_status", "unknown")
        
        event_type = "progress"
        if success_status in ["passed", "failed"]:
            event_type = success_status
        elif completion_status == "completed":
            event_type = "completed"
        elif completion_status == "unknown":
            event_type = "initialized"
            
        progress = cmi_data.get("cmi.progress_measure")
        progress_pct = None
        if progress and str(progress).strip():
            try:
                progress_pct = int(float(progress) * 100)
            except ValueError:
                pass
        elif completion_status == "completed" or success_status == "passed":
            progress_pct = 100
            
        score_scaled = cmi_data.get("cmi.score.scaled")
        score_raw = cmi_data.get("cmi.score.raw")
        score_float = None
        if score_scaled and score_scaled.strip():
            try:
                score_float = float(score_scaled) * 100
            except ValueError:
                pass
        elif score_raw and score_raw.strip():
            try:
                score_float = float(score_raw)
            except ValueError:
                pass
                
        total_time_str = cmi_data.get("cmi.total_time", "")
        duration_sec = int(Scorm2004Adapter._parse_iso8601_duration(total_time_str)) if total_time_str else 0
            
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
            # Convert dict to list
            metadata["interactions"] = [interactions[i] for i in sorted(interactions.keys())]

        return LearningEvent(
            user_id=attempt.user_id,
            course_id=attempt.course_id,
            package_id=attempt.package_id,
            attempt_id=attempt.id,
            activity_id=None,
            event_type=event_type,
            progress_percent=progress_pct,
            completion_status=completion_status,
            success_status=success_status,
            score_raw=score_float,
            duration_seconds=duration_sec,
            location=cmi_data.get("cmi.location"),
            timestamp=datetime.now(timezone.utc),
            source_standard="SCORM_2004",
            source_event_id=str(uuid.uuid4()),
            metadata=metadata
        )
