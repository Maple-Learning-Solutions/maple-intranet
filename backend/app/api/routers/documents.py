from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.document import Document, DocumentCategory
from app.api.deps import get_current_user, require_admin

router = APIRouter()

@router.get("/categories", response_model=None)
async def get_document_categories(
    db: AsyncSession = Depends(get_db),
    # current_user = Depends(get_current_user)
):
    result = await db.execute(select(DocumentCategory))
    return result.scalars().all()

@router.get("", response_model=None)
async def get_documents(
    main_category: str | None = None,
    subcategory: str | None = None,
    db: AsyncSession = Depends(get_db),
    # current_user = Depends(get_current_user)
):
    from sqlalchemy.orm import selectinload
    query = select(Document).options(selectinload(Document.category))
    
    if main_category or subcategory:
        query = query.join(Document.category)
        if main_category:
            query = query.where(DocumentCategory.main_category == main_category)
        if subcategory:
            query = query.where(DocumentCategory.name == subcategory)
    
    result = await db.execute(query)
    documents = result.scalars().all()
    return documents

@router.get("/{document_id}", response_model=None)
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    # current_user = Depends(get_current_user)
):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.category))
        .where(Document.id == document_id)
    )
    return result.scalars().first()

from pydantic import BaseModel, validator
from urllib.parse import urlparse

class DocumentCreate(BaseModel):
    title: str
    description: str | None = None
    main_category: str
    subcategory: str
    department_id: int | None = None
    drive_url: str
    thumbnail_url: str | None = None
    document_type: str = "DOCUMENT"
    visibility: str = "ALL_EMPLOYEES"

    @validator("drive_url", "thumbnail_url")
    def validate_url(cls, v):
        if v:
            parsed = urlparse(v)
            if parsed.scheme != "https":
                raise ValueError("URL must use HTTPS protocol")
        return v

@router.post("", response_model=None)
async def create_document(
    doc_in: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_admin)
):
    from fastapi import HTTPException
    
    # Resolve and validate category
    cat_res = await db.execute(
        select(DocumentCategory).where(
            DocumentCategory.main_category == doc_in.main_category,
            DocumentCategory.name == doc_in.subcategory
        )
    )
    category = cat_res.scalars().first()
    if not category:
        raise HTTPException(status_code=422, detail="Invalid main category and subcategory combination")

    document = Document(
        title=doc_in.title,
        description=doc_in.description,
        category_id=category.id,
        department_id=doc_in.department_id,
        drive_url=doc_in.drive_url,
        thumbnail_url=doc_in.thumbnail_url,
        document_type=doc_in.document_type,
        visibility=doc_in.visibility,
        version="1.0",
        status="PUBLISHED",
        created_by=current_user.id
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return document

class DocumentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    main_category: str | None = None
    subcategory: str | None = None
    department_id: int | None = None
    drive_url: str | None = None
    thumbnail_url: str | None = None
    visibility: str | None = None

    @validator("drive_url", "thumbnail_url")
    def validate_url(cls, v):
        if v is not None and v != "":
            parsed = urlparse(v)
            if parsed.scheme != "https":
                raise ValueError("URL must use HTTPS protocol")
        return v

@router.put("/{document_id}", response_model=None)
async def update_document(
    document_id: int,
    doc_in: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_admin)
):
    from fastapi import HTTPException
    
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalars().first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    update_data = doc_in.dict(exclude_unset=True)
    
    # Handle category update
    if "main_category" in update_data or "subcategory" in update_data:
        # If updating categories, we need both to validate, or fall back to existing category info
        cat_result = await db.execute(select(DocumentCategory).where(DocumentCategory.id == document.category_id))
        current_cat = cat_result.scalars().first()
        
        new_main = update_data.pop("main_category", current_cat.main_category if current_cat else None)
        new_sub = update_data.pop("subcategory", current_cat.name if current_cat else None)
        
        cat_res = await db.execute(
            select(DocumentCategory).where(
                DocumentCategory.main_category == new_main,
                DocumentCategory.name == new_sub
            )
        )
        category = cat_res.scalars().first()
        if not category:
            raise HTTPException(status_code=422, detail="Invalid main category and subcategory combination")
            
        document.category_id = category.id

    for field, value in update_data.items():
        setattr(document, field, value)
        
    await db.commit()
    await db.refresh(document)
    return document

@router.delete("/{document_id}", response_model=None)
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_admin)
):
    from fastapi import HTTPException
    
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalars().first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    await db.delete(document)
    await db.commit()
    return {"message": "Document deleted successfully"}
