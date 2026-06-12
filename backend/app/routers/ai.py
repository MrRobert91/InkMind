from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import ai_service, llm, models, schemas
from ..database import get_db
from .chapters import get_chapter_or_404
from .projects import get_project_or_404

router = APIRouter(prefix="/api", tags=["ai"])


@router.get("/frameworks")
def list_frameworks():
    return [{"id": key, "description": desc} for key, desc in ai_service.FRAMEWORKS.items()]


@router.get("/ai/actions")
def list_edit_actions():
    return [{"id": key, "description": desc} for key, desc in ai_service.EDIT_ACTIONS.items()]


# ---------- Providers & per-task model routing ----------

@router.get("/ai/providers")
def list_providers():
    return llm.providers_info()


@router.get("/ai/task-settings", response_model=list[schemas.TaskSettingOut])
def get_task_settings(db: Session = Depends(get_db)):
    stored = {s.task: s for s in db.query(models.AISetting).all()}
    fallback = llm.default_provider()
    result = []
    for task, label in llm.TASKS.items():
        setting = stored.get(task)
        if setting and setting.provider in llm.PROVIDERS:
            provider, model = setting.provider, setting.model
        else:
            provider = fallback or "anthropic"
            model = ""
        result.append(
            schemas.TaskSettingOut(
                task=task,
                label=label,
                provider=provider,
                model=model or llm.PROVIDERS[provider]["default_model"],
            )
        )
    return result


@router.put("/ai/task-settings", response_model=list[schemas.TaskSettingOut])
def save_task_settings(payload: list[schemas.TaskSettingIn], db: Session = Depends(get_db)):
    for item in payload:
        if item.task not in llm.TASKS:
            raise HTTPException(status_code=400, detail=f"Tarea desconocida: {item.task}")
        if item.provider not in llm.PROVIDERS:
            raise HTTPException(status_code=400, detail=f"Proveedor desconocido: {item.provider}")
        setting = db.query(models.AISetting).filter_by(task=item.task).first()
        if setting is None:
            setting = models.AISetting(task=item.task)
            db.add(setting)
        setting.provider = item.provider
        setting.model = item.model.strip()
    db.commit()
    return get_task_settings(db)


# ---------- Chat ----------

@router.get("/projects/{project_id}/chat", response_model=list[schemas.ChatMessageOut])
def get_chat(project_id: int, db: Session = Depends(get_db)):
    get_project_or_404(project_id, db)
    return (
        db.query(models.ChatMessage)
        .filter_by(project_id=project_id)
        .order_by(models.ChatMessage.id)
        .all()
    )


@router.post("/projects/{project_id}/chat", response_model=schemas.ChatMessageOut)
@ai_service.handle_ai_errors
def send_chat(project_id: int, payload: schemas.ChatMessageIn, db: Session = Depends(get_db)):
    project = get_project_or_404(project_id, db)
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="El mensaje está vacío")

    chapter = None
    if payload.chapter_id:
        chapter = get_chapter_or_404(payload.chapter_id, db)

    user_msg = models.ChatMessage(project_id=project_id, role="user", content=payload.content)
    db.add(user_msg)
    db.commit()

    history = [
        {"role": m.role, "content": m.content}
        for m in db.query(models.ChatMessage)
        .filter_by(project_id=project_id)
        .order_by(models.ChatMessage.id)
        .all()
    ]
    reply = ai_service.chat_reply(db, project, history, chapter)

    assistant_msg = models.ChatMessage(project_id=project_id, role="assistant", content=reply)
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)
    return assistant_msg


@router.delete("/projects/{project_id}/chat", status_code=204)
def clear_chat(project_id: int, db: Session = Depends(get_db)):
    get_project_or_404(project_id, db)
    db.query(models.ChatMessage).filter_by(project_id=project_id).delete()
    db.commit()


# ---------- Structure generation ----------

@router.post("/projects/{project_id}/generate-structure", response_model=list[schemas.ChapterOut])
@ai_service.handle_ai_errors
def generate_structure(project_id: int, payload: schemas.GenerateStructureIn, db: Session = Depends(get_db)):
    project = get_project_or_404(project_id, db)
    framework = payload.framework or project.framework
    chapters_data = ai_service.generate_structure(
        db, project, framework, payload.num_chapters, payload.instructions
    )

    if payload.framework and payload.framework != project.framework:
        project.framework = payload.framework

    start = len(project.chapters)
    created = []
    for offset, data in enumerate(chapters_data):
        chapter = models.Chapter(
            project_id=project.id,
            title=data.get("title", f"Capítulo {start + offset + 1}"),
            summary=data.get("summary", ""),
            conflict=data.get("conflict", ""),
            emotion=data.get("emotion", ""),
            narrative_function=data.get("narrative_function", ""),
            order_index=start + offset,
            status="outline",
        )
        db.add(chapter)
        created.append(chapter)
    db.commit()
    for chapter in created:
        db.refresh(chapter)
    return created


# ---------- Fragment editing ----------

@router.post("/projects/{project_id}/edit-fragment", response_model=schemas.EditFragmentOut)
@ai_service.handle_ai_errors
def edit_fragment(project_id: int, payload: schemas.EditFragmentIn, db: Session = Depends(get_db)):
    project = get_project_or_404(project_id, db)
    if not payload.fragment.strip():
        raise HTTPException(status_code=400, detail="Selecciona un fragmento de texto")
    chapter = get_chapter_or_404(payload.chapter_id, db) if payload.chapter_id else None
    result = ai_service.edit_fragment(
        db, project, payload.fragment, payload.action, payload.instructions, chapter
    )
    return schemas.EditFragmentOut(result=result)


# ---------- Story summary ----------

@router.post("/projects/{project_id}/summary", response_model=schemas.StorySummaryOut)
@ai_service.handle_ai_errors
def story_summary(project_id: int, db: Session = Depends(get_db)):
    project = get_project_or_404(project_id, db)
    return schemas.StorySummaryOut(summary=ai_service.story_summary(db, project))
