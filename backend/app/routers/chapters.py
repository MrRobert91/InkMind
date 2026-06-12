from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .projects import get_project_or_404

router = APIRouter(prefix="/api", tags=["chapters"])

MAX_AUTO_VERSIONS = 50


def get_chapter_or_404(chapter_id: int, db: Session) -> models.Chapter:
    chapter = db.get(models.Chapter, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Capítulo no encontrado")
    return chapter


def _snapshot(chapter: models.Chapter, db: Session, note: str, origin: str) -> models.ChapterVersion:
    version = models.ChapterVersion(
        chapter_id=chapter.id,
        title=chapter.title,
        content=chapter.content,
        note=note,
        origin=origin,
    )
    db.add(version)
    # Keep automatic history bounded; manual milestones are never pruned.
    autos = (
        db.query(models.ChapterVersion)
        .filter_by(chapter_id=chapter.id, origin="auto")
        .order_by(models.ChapterVersion.id.desc())
        .offset(MAX_AUTO_VERSIONS)
        .all()
    )
    for old in autos:
        db.delete(old)
    return version


@router.get("/projects/{project_id}/chapters", response_model=list[schemas.ChapterOut])
def list_chapters(project_id: int, db: Session = Depends(get_db)):
    get_project_or_404(project_id, db)
    return (
        db.query(models.Chapter)
        .filter_by(project_id=project_id)
        .order_by(models.Chapter.order_index)
        .all()
    )


@router.post("/projects/{project_id}/chapters", response_model=schemas.ChapterOut, status_code=201)
def create_chapter(project_id: int, payload: schemas.ChapterCreate, db: Session = Depends(get_db)):
    project = get_project_or_404(project_id, db)
    chapter = models.Chapter(
        project_id=project.id,
        order_index=len(project.chapters),
        **payload.model_dump(),
    )
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return chapter


@router.put("/projects/{project_id}/chapters/reorder", response_model=list[schemas.ChapterOut])
def reorder_chapters(project_id: int, payload: schemas.ChapterReorder, db: Session = Depends(get_db)):
    project = get_project_or_404(project_id, db)
    by_id = {c.id: c for c in project.chapters}
    if set(payload.chapter_ids) != set(by_id):
        raise HTTPException(status_code=400, detail="La lista de capítulos no coincide con el proyecto")
    for index, chapter_id in enumerate(payload.chapter_ids):
        by_id[chapter_id].order_index = index
    db.commit()
    return (
        db.query(models.Chapter)
        .filter_by(project_id=project_id)
        .order_by(models.Chapter.order_index)
        .all()
    )


@router.get("/chapters/{chapter_id}", response_model=schemas.ChapterOut)
def get_chapter(chapter_id: int, db: Session = Depends(get_db)):
    return get_chapter_or_404(chapter_id, db)


@router.put("/chapters/{chapter_id}", response_model=schemas.ChapterOut)
def update_chapter(chapter_id: int, payload: schemas.ChapterUpdate, db: Session = Depends(get_db)):
    chapter = get_chapter_or_404(chapter_id, db)
    data = payload.model_dump(exclude_unset=True)
    version_note = data.pop("version_note", None)

    content_changes = "content" in data and data["content"] != chapter.content
    if content_changes and chapter.content.strip():
        _snapshot(chapter, db, version_note or "Guardado automático", "auto")

    for field, value in data.items():
        setattr(chapter, field, value)
    db.commit()
    db.refresh(chapter)
    return chapter


@router.delete("/chapters/{chapter_id}", status_code=204)
def delete_chapter(chapter_id: int, db: Session = Depends(get_db)):
    chapter = get_chapter_or_404(chapter_id, db)
    project_id = chapter.project_id
    db.delete(chapter)
    db.commit()
    # Compact ordering after removal
    remaining = (
        db.query(models.Chapter)
        .filter_by(project_id=project_id)
        .order_by(models.Chapter.order_index)
        .all()
    )
    for index, ch in enumerate(remaining):
        ch.order_index = index
    db.commit()


# ---------- Versions ----------

@router.get("/chapters/{chapter_id}/versions", response_model=list[schemas.VersionOut])
def list_versions(chapter_id: int, db: Session = Depends(get_db)):
    get_chapter_or_404(chapter_id, db)
    return (
        db.query(models.ChapterVersion)
        .filter_by(chapter_id=chapter_id)
        .order_by(models.ChapterVersion.id.desc())
        .all()
    )


@router.post("/chapters/{chapter_id}/versions", response_model=schemas.VersionOut, status_code=201)
def create_milestone(chapter_id: int, payload: schemas.VersionCreate, db: Session = Depends(get_db)):
    chapter = get_chapter_or_404(chapter_id, db)
    version = _snapshot(chapter, db, payload.note or "Hito manual", "manual")
    db.commit()
    db.refresh(version)
    return version


@router.post("/versions/{version_id}/restore", response_model=schemas.ChapterOut)
def restore_version(version_id: int, db: Session = Depends(get_db)):
    version = db.get(models.ChapterVersion, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Versión no encontrada")
    chapter = version.chapter
    # Snapshot the current state before overwriting it, so a restore is reversible.
    _snapshot(chapter, db, f"Antes de restaurar la versión #{version.id}", "restore")
    chapter.title = version.title
    chapter.content = version.content
    db.commit()
    db.refresh(chapter)
    return chapter
