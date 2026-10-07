import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.database import get_db
from app.models.learning import LearningAttempt, ScormRuntimeState, LearningPackage
from app.learning.standards.scorm12.adapter import Scorm12Adapter
from app.learning.standards.scorm2004.adapter import Scorm2004Adapter

router = APIRouter()

class InitRequest(BaseModel):
    package_id: int
    course_id: int | None = None
    user_id: str

class CommitRequest(BaseModel):
    attempt_id: int
    cmi_data: dict

@router.post("/initialize")
async def initialize_session(req: InitRequest, db: AsyncSession = Depends(get_db)):
    # 1. Check if package exists
    pkg_res = await db.execute(select(LearningPackage).where(LearningPackage.id == req.package_id))
    package = pkg_res.scalars().first()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
        
    # 2. Find latest attempt
    query = (
        select(LearningAttempt)
        .where(LearningAttempt.user_id == req.user_id)
        .where(LearningAttempt.package_id == req.package_id)
    )
    if req.course_id:
        query = query.where(LearningAttempt.course_id == req.course_id)
        course_id = req.course_id
    else:
        # Fallback for older players that don't pass course_id
        from app.models.learning import CourseModule
        module_res = await db.execute(select(CourseModule).where(CourseModule.learning_package_id == req.package_id))
        module = module_res.scalars().first()
        course_id = module.course_id if module else None
        
    query = query.order_by(LearningAttempt.attempt_number.desc())
    
    attempt_res = await db.execute(query)
    attempt = attempt_res.scalars().first()

    # 3. Create attempt if it doesn't exist
    if not attempt:
        attempt = LearningAttempt(
            user_id=req.user_id,
            course_id=course_id,
            package_id=req.package_id,
            attempt_number=1,
            standard=package.standard.lower(),
            status="incomplete" if package.standard.lower() in ["scorm_1_2", "scorm_2004"] else "unknown"
        )
        db.add(attempt)
        await db.commit()
        await db.refresh(attempt)
        
    # 4. Find or create ScormRuntimeState
    state_res = await db.execute(select(ScormRuntimeState).where(ScormRuntimeState.attempt_id == attempt.id))
    state = state_res.scalars().first()
    
    if not state:
        # Initialize default CMI data based on standard
        cmi_data = {}
        if attempt.standard == "scorm_1_2":
            cmi_data = Scorm12Adapter.get_initial_cmi(req.user_id, "Learner, Mock")
            cmi_data["cmi.core.entry"] = "ab-initio"
        elif attempt.standard == "scorm_2004":
            cmi_data = Scorm2004Adapter.get_initial_cmi(req.user_id, "Learner, Mock")
            
        columns = Scorm12Adapter.extract_state_columns(cmi_data)
        state = ScormRuntimeState(
            attempt_id=attempt.id, 
            package_id=req.package_id,
            cmi_data=cmi_data,
            **columns
        )
        db.add(state)
        await db.commit()
        await db.refresh(state)
    else:
        # Reconstruct cmi_data from explicitly stored columns to serve to the frontend
        if attempt.standard == "scorm_1_2":
            cmi_data = state.cmi_data or {}
            
            # Repopulate from columns
            if state.lesson_status: cmi_data["cmi.core.lesson_status"] = state.lesson_status
            if state.lesson_location: cmi_data["cmi.core.lesson_location"] = state.lesson_location
            if state.suspend_data: cmi_data["cmi.suspend_data"] = state.suspend_data
            if state.score_raw is not None: cmi_data["cmi.core.score.raw"] = str(state.score_raw)
            if state.score_min is not None: cmi_data["cmi.core.score.min"] = str(state.score_min)
            if state.score_max is not None: cmi_data["cmi.core.score.max"] = str(state.score_max)
            if state.total_time: cmi_data["cmi.core.total_time"] = state.total_time
            if state.lesson_mode: cmi_data["cmi.core.lesson_mode"] = state.lesson_mode
            if state.credit: cmi_data["cmi.core.credit"] = state.credit
            
            # Logic for Entry
            if state.exit == "suspend" or (state.suspend_data and len(state.suspend_data) > 0):
                cmi_data["cmi.core.entry"] = "resume"
            else:
                cmi_data["cmi.core.entry"] = ""
                
            # Clear session time on new launch
            cmi_data["cmi.core.session_time"] = "00:00:00"
        else:
            cmi_data = state.cmi_data

    return {
        "attempt_id": attempt.id,
        "standard": attempt.standard,
        "cmi_data": cmi_data,
        "error": "0"
    }

@router.post("/commit")
async def commit_data(req: CommitRequest, db: AsyncSession = Depends(get_db)):
    # Fast path: Find attempt to get standard and user_id
    attempt_res = await db.execute(select(LearningAttempt).where(LearningAttempt.id == req.attempt_id))
    attempt = attempt_res.scalars().first()
    
    if not attempt:
        return {"error": "201"} # Not found

    # Synchronously update ScormRuntimeState so the player can immediately resume correctly
    state_res = await db.execute(select(ScormRuntimeState).where(ScormRuntimeState.attempt_id == attempt.id))
    state = state_res.scalars().first()
    merged_data = req.cmi_data
    
    if state:
        current_data = state.cmi_data or {}
        # We must reassign to trigger SQLAlchemy JSON detection or use flag_modified
        merged_data = {**current_data, **req.cmi_data}
        state.cmi_data = merged_data
        
        # Also map explicit columns if needed
        if attempt.standard == "scorm_1_2":
            cols = Scorm12Adapter.extract_state_columns(merged_data)
        else:
            cols = Scorm2004Adapter.extract_state_columns(merged_data)
            
        for k, v in cols.items():
            if v is not None or k in req.cmi_data:
                setattr(state, k, v)
                
    import uuid
    from app.models.learning import TrackingEventInbox
    
    inbox_id = str(uuid.uuid4())
    inbox_event = TrackingEventInbox(
        id=inbox_id,
        user_id=attempt.user_id,
        course_id=attempt.course_id,
        package_id=attempt.package_id,
        attempt_id=attempt.id,
        source=attempt.standard.upper() if attempt.standard else "SYSTEM",
        event_type="COMMIT",
        payload=merged_data,
        status="received"
    )
    db.add(inbox_event)
    await db.commit()
    
    # Enqueue Celery task
    from app.workers.tracking_worker import process_tracking_event
    process_tracking_event.delay(inbox_id)
    
    return {"error": "0"}

@router.post("/finish")
async def finish_session(req: CommitRequest, db: AsyncSession = Depends(get_db)):
    # Commit any final data first. This enqueues a celery task which will 
    # update the attempt's last_activity_at and other progress metrics asynchronously.
    await commit_data(req, db)
    return {"error": "0"}

@router.get("/attempts/{attempt_id}/runtime-state")
async def get_runtime_state(attempt_id: int, db: AsyncSession = Depends(get_db)):
    state_res = await db.execute(select(ScormRuntimeState).where(ScormRuntimeState.attempt_id == attempt_id))
    state = state_res.scalars().first()
    if not state:
        raise HTTPException(status_code=404, detail="Runtime state not found")
        
    attempt_res = await db.execute(select(LearningAttempt).where(LearningAttempt.id == attempt_id))
    attempt = attempt_res.scalars().first()
    
    return {
        "attempt_id": attempt.id,
        "standard": attempt.standard,
        "package_id": attempt.package_id,
        "status": attempt.status,
        "progress_percent": attempt.progress_percent,
        "state": {
            "lesson_status": state.lesson_status,
            "lesson_location": state.lesson_location,
            "suspend_data_present": state.suspend_data is not None and len(state.suspend_data) > 0,
            "score_raw": state.score_raw,
            "session_time": state.session_time,
            "total_time": state.total_time,
            "entry": state.entry,
            "exit": state.exit
        },
        "raw_cmi_data_keys": list((state.cmi_data or {}).keys()),
        "updated_at": state.updated_at
    }
