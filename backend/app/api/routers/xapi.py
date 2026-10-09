from fastapi import APIRouter, Depends, HTTPException, Body, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, List, Union
import logging

from app.core.database import get_db
from app.learning.services.lrs_service import NativeLRSService
from app.learning.standards.cmi5.validation import Cmi5Validator
from app.learning.standards.cmi5.validation import Cmi5Validator
from app.models.learning import XApiState, XApiProfile, LearningAttempt, LearningPackage

router = APIRouter()

class XApiInitRequest(BaseModel):
    package_id: int
    course_id: int | None = None
    user_id: str

@router.post("/launch/init")
async def initialize_xapi_session(req: XApiInitRequest, db: AsyncSession = Depends(get_db)):
    import uuid
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
        # Look up course_id from CourseModule (if available)
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
            standard=package.package_type or "xapi",
            status="incomplete"
        )
        db.add(attempt)
        await db.commit()
        await db.refresh(attempt)
        
    # 4. Generate stable registration UUID based on the attempt ID
    stable_registration = str(uuid.uuid5(uuid.NAMESPACE_URL, f"urn:lms:attempt:{attempt.id}"))
    
    # Save the registration UUID to the attempt
    attempt.xapi_registration_uuid = stable_registration
    await db.commit()
    
    return {
        "attempt_id": attempt.id,
        "registration": stable_registration
    }

@router.post("/statements")
async def post_statement(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    import json
    
    # Handle xAPI Alternate Request Syntax (form-encoded POST with method=PUT/POST)
    content_type = request.headers.get("content-type", "")
    method_param = request.query_params.get("method")
    
    statements = []
    
    if "application/json" in content_type:
        body = await request.json()
        statements = body if isinstance(body, list) else [body]
    elif "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        # The statement could be in 'statement' or 'content'
        statement_str = form.get("statement") or form.get("content")
        if statement_str:
            body = json.loads(statement_str)
            statements = body if isinstance(body, list) else [body]
    else:
        # Fallback to reading raw body and parsing
        body_bytes = await request.body()
        if body_bytes:
            body = json.loads(body_bytes)
            statements = body if isinstance(body, list) else [body]

    if not statements:
        raise HTTPException(status_code=400, detail="No valid statements found in request")

    # 1. Validation
    for stmt in statements:
        if "actor" not in stmt or "verb" not in stmt or "object" not in stmt:
            raise HTTPException(status_code=400, detail="Invalid xAPI statement: missing actor, verb, or object")

    # 2. Diagnostic Logging
    verbs = [stmt.get("verb", {}).get("id", "").split("/")[-1] for stmt in statements]
    registration_id = statements[0].get("context", {}).get("registration") if statements else None
    activity_id = statements[0].get("object", {}).get("id") if statements else None
    
    logging.info(f"[xAPI] Received {len(statements)} statements.")
    logging.info(f"[xAPI] Verbs: {verbs}")
    logging.info(f"[xAPI] Registration: {registration_id}")
    logging.info(f"[xAPI] Activity ID: {activity_id}")

    # 3. Generate Statement IDs for spec compliance and create Inbox Events
    import uuid
    from app.models.learning import TrackingEventInbox
    from app.workers.tracking_worker import process_tracking_event
    
    statement_ids = []
    
    for stmt in statements:
        if "id" not in stmt:
            stmt["id"] = str(uuid.uuid4())
        statement_ids.append(stmt["id"])
        
    user_id = None
    if statements and "actor" in statements[0]:
        actor = statements[0]["actor"]
        if "account" in actor and "name" in actor["account"]:
            user_id = actor["account"]["name"]
        elif "mbox" in actor:
            user_id = actor["mbox"].replace("mailto:", "")
            
        if not user_id:
            user_id = None
        
    inbox_id = str(uuid.uuid4())
    inbox_event = TrackingEventInbox(
        id=inbox_id,
        user_id=user_id,
        course_id=None,
        package_id=None,
        attempt_id=None,
        source="XAPI",
        event_type="STATEMENT",
        payload=statements,
        status="received"
    )
    db.add(inbox_event)
    await db.commit()
    
    # Enqueue Celery task
    process_tracking_event.delay(inbox_id)
            
    return statement_ids # xAPI 1.0.3 specification returns an array of statement IDs

@router.put("/statements")
async def put_statement(
    statementId: str,
    request: Request,
    statement: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db)
):
    try:
        statement["id"] = statementId
        
        import uuid
        from app.models.learning import TrackingEventInbox
        from app.workers.tracking_worker import process_tracking_event
        from fastapi import Response
        
        user_id = None
        actor = statement.get("actor", {})
        if "account" in actor and "name" in actor["account"]:
            user_id = actor["account"]["name"]
        elif "mbox" in actor:
            user_id = actor["mbox"].replace("mailto:", "")
            
        if not user_id:
            user_id = None
        
        inbox_id = str(uuid.uuid4())
        inbox_event = TrackingEventInbox(
            id=inbox_id,
            user_id=user_id,
            source="XAPI",
            event_type="STATEMENT",
            payload=[statement],
            status="received"
        )
        db.add(inbox_event)
        await db.commit()
        
        process_tracking_event.delay(inbox_id)
            
        return Response(status_code=204)
    except Exception as e:
        import traceback
        import logging
        logging.error(traceback.format_exc())
        return Response(status_code=500, content="Internal Server Error")

@router.get("/statements")
async def get_statements(db: AsyncSession = Depends(get_db)):
    lrs_service = NativeLRSService(db)
    statements = await lrs_service.get_statements()
    return {"statements": statements}

@router.get("/agents/profile")
@router.get("/statements/agents/profile")
async def get_agent_profile(agent: str, profileId: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(XApiProfile).where(XApiProfile.agent_id == agent).where(XApiProfile.profile_id == profileId)
    )
    profile = result.scalars().first()
    if profile:
        return profile.profile_data
    raise HTTPException(status_code=404, detail="Profile not found")

@router.put("/agents/profile")
@router.put("/statements/agents/profile")
async def put_agent_profile(agent: str, profileId: str, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        data = await request.json()
    except:
        data = (await request.body()).decode('utf-8')
        
    result = await db.execute(
        select(XApiProfile).where(XApiProfile.agent_id == agent).where(XApiProfile.profile_id == profileId)
    )
    profile = result.scalars().first()
    if profile:
        profile.profile_data = data
    else:
        profile = XApiProfile(agent_id=agent, profile_id=profileId, profile_data=data)
        db.add(profile)
    await db.commit()
    return "", 204

@router.post("/agents/profile")
@router.post("/statements/agents/profile")
async def post_agent_profile(agent: str, profileId: str, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        new_data = await request.json()
    except:
        new_data = (await request.body()).decode('utf-8')
        
    result = await db.execute(
        select(XApiProfile).where(XApiProfile.agent_id == agent).where(XApiProfile.profile_id == profileId)
    )
    profile = result.scalars().first()
    
    if profile and isinstance(profile.profile_data, dict) and isinstance(new_data, dict):
        # Merge dicts
        merged = dict(profile.profile_data)
        merged.update(new_data)
        profile.profile_data = merged
    elif profile:
        profile.profile_data = new_data
    else:
        profile = XApiProfile(agent_id=agent, profile_id=profileId, profile_data=new_data)
        db.add(profile)
        
    await db.commit()
    return "", 204

@router.get("/activities")
@router.get("/statements/activities")
async def get_activity(activityId: str):
    # Stub for standard xAPI Activity API
    return {
        "id": activityId,
        "definition": {
            "name": {"en-US": "Course Activity"},
            "description": {"en-US": "A course activity."}
        }
    }

@router.get("/activities/state")
@router.get("/statements/activities/state")
async def get_activity_state(
    stateId: str,
    activityId: str,
    agent: str,
    registration: str = None,
    db: AsyncSession = Depends(get_db)
):
    import json
    logging.info(f"[xAPI-GET-STATE] Req: stateId={stateId}, activityId={activityId}, registration={registration}, agent={agent}")
    try:
        agent_obj = json.loads(agent)
        agent_normalized = json.dumps(agent_obj, sort_keys=True)
    except:
        agent_normalized = agent

    query = select(XApiState).where(XApiState.activity_id == activityId).where(XApiState.agent_id == agent_normalized).where(XApiState.state_id == stateId)
    if registration:
        query = query.where(XApiState.registration == registration)
    else:
        query = query.where(XApiState.registration.is_(None))
        
    result = await db.execute(query)
    state = result.scalars().first()
    
    if state:
        from fastapi.responses import Response
        import json
        logging.info(f"[xAPI-GET-STATE] Found state in DB. Type: {type(state.state_data)}")
        c_type = state.content_type or "application/octet-stream"
        
        if isinstance(state.state_data, (dict, list)):
            return Response(content=json.dumps(state.state_data), media_type=c_type)
        elif isinstance(state.state_data, str):
            return Response(content=state.state_data, media_type=c_type)
        else:
            return Response(content=str(state.state_data), media_type=c_type)
        
    logging.info(f"[xAPI-GET-STATE] State not found in DB.")
        
    # cmi5 requires LMS.LaunchData to be pre-populated by the LMS
    if stateId == "LMS.LaunchData":
        return {
            "launchMode": "Normal",
            "launchParameters": "",
            "entitlementKey": {
                "courseStructure": "",
                "alternate": ""
            },
            "contextTemplate": {
                "contextActivities": {
                    "grouping": [{"id": activityId}]
                }
            }
        }
        
    # If not found, xAPI spec requires a 404 for state
    raise HTTPException(status_code=404, detail="State not found")

@router.put("/activities/state")
@router.put("/statements/activities/state")
async def put_activity_state(
    stateId: str,
    activityId: str,
    agent: str,
    request: Request,
    registration: str = None,
    db: AsyncSession = Depends(get_db)
):
    import json
    content_type = request.headers.get("content-type")
    logging.info(f"[xAPI-PUT-STATE] Req: stateId={stateId}, activityId={activityId}, registration={registration}, type={content_type}")
    try:
        agent_obj = json.loads(agent)
        agent_normalized = json.dumps(agent_obj, sort_keys=True)
    except:
        agent_normalized = agent
        
    try:
        data = await request.json()
        logging.info(f"[xAPI-PUT-STATE] Parsed as JSON: {type(data)}")
    except:
        data = (await request.body()).decode('utf-8')
        logging.info(f"[xAPI-PUT-STATE] Parsed as string: {len(data)} chars")
        
    query = select(XApiState).where(XApiState.activity_id == activityId).where(XApiState.agent_id == agent_normalized).where(XApiState.state_id == stateId)
    if registration:
        query = query.where(XApiState.registration == registration)
    else:
        query = query.where(XApiState.registration.is_(None))
        
    result = await db.execute(query)
    state = result.scalars().first()
    
    if state:
        state.state_data = data
        state.content_type = content_type
    else:
        state = XApiState(activity_id=activityId, agent_id=agent_normalized, registration=registration, state_id=stateId, state_data=data, content_type=content_type)
        db.add(state)
        
    await db.commit()
    return "", 204

@router.post("/activities/state")
@router.post("/statements/activities/state")
async def post_activity_state(
    request: Request,
    stateId: str = None,
    activityId: str = None,
    agent: str = None,
    registration: str = None,
    db: AsyncSession = Depends(get_db)
):
    import json
    content_type = request.headers.get("content-type", "")
    
    # In Alternate Request Syntax, parameters are in the form body
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        stateId = stateId or form.get("stateId")
        activityId = activityId or form.get("activityId")
        agent = agent or form.get("agent")
        registration = registration or form.get("registration")
        content = form.get("content")
        actual_content_type = form.get("contentType") or "application/octet-stream"
        content_type = actual_content_type
        try:
            new_data = json.loads(content) if content else {}
        except:
            new_data = content
    else:
        try:
            new_data = await request.json()
            logging.info(f"[xAPI-POST-STATE] Req: stateId={stateId}, activityId={activityId}, registration={registration}. Parsed as JSON.")
        except:
            new_data = (await request.body()).decode('utf-8')
            logging.info(f"[xAPI-POST-STATE] Req: stateId={stateId}, activityId={activityId}, registration={registration}. Parsed as string.")
            
    if not stateId or not activityId or not agent:
        raise HTTPException(status_code=400, detail="Missing required parameters (stateId, activityId, agent)")
        
    try:
        agent_obj = json.loads(agent)
        agent_normalized = json.dumps(agent_obj, sort_keys=True)
    except:
        agent_normalized = agent
        
    query = select(XApiState).where(XApiState.activity_id == activityId).where(XApiState.agent_id == agent_normalized).where(XApiState.state_id == stateId)
    if registration:
        query = query.where(XApiState.registration == registration)
    else:
        query = query.where(XApiState.registration.is_(None))
        
    result = await db.execute(query)
    state = result.scalars().first()
    
    if state and isinstance(state.state_data, dict) and isinstance(new_data, dict):
        def deep_merge(dict1, dict2):
            result = dict(dict1)
            for k, v in dict2.items():
                if k in result and isinstance(result[k], dict) and isinstance(v, dict):
                    result[k] = deep_merge(result[k], v)
                else:
                    result[k] = v
            return result
            
        state.state_data = deep_merge(state.state_data, new_data)
        state.content_type = content_type
    elif state:
        state.state_data = new_data
        state.content_type = content_type
    else:
        state = XApiState(activity_id=activityId, agent_id=agent_normalized, registration=registration, state_id=stateId, state_data=new_data, content_type=content_type)
        db.add(state)
        
    await db.commit()
    return "", 204

@router.delete("/activities/state")
@router.delete("/statements/activities/state")
async def delete_activity_state(
    stateId: str,
    activityId: str,
    agent: str,
    registration: str = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(XApiState).where(XApiState.activity_id == activityId).where(XApiState.agent_id == agent).where(XApiState.state_id == stateId)
    if registration:
        query = query.where(XApiState.registration == registration)
    else:
        query = query.where(XApiState.registration.is_(None))
        
    result = await db.execute(query)
    state = result.scalars().first()
    if state:
        await db.delete(state)
        await db.commit()
    return "", 204
