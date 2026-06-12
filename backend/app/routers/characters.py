from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .projects import get_project_or_404

router = APIRouter(prefix="/api", tags=["characters"])


def get_character_or_404(character_id: int, db: Session) -> models.Character:
    character = db.get(models.Character, character_id)
    if character is None:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")
    return character


@router.get("/projects/{project_id}/characters", response_model=list[schemas.CharacterOut])
def list_characters(project_id: int, db: Session = Depends(get_db)):
    get_project_or_404(project_id, db)
    return (
        db.query(models.Character)
        .filter_by(project_id=project_id)
        .order_by(models.Character.id)
        .all()
    )


@router.post("/projects/{project_id}/characters", response_model=schemas.CharacterOut, status_code=201)
def create_character(project_id: int, payload: schemas.CharacterCreate, db: Session = Depends(get_db)):
    get_project_or_404(project_id, db)
    character = models.Character(project_id=project_id, **payload.model_dump())
    db.add(character)
    db.commit()
    db.refresh(character)
    return character


@router.put("/characters/{character_id}", response_model=schemas.CharacterOut)
def update_character(character_id: int, payload: schemas.CharacterUpdate, db: Session = Depends(get_db)):
    character = get_character_or_404(character_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(character, field, value)
    db.commit()
    db.refresh(character)
    return character


@router.delete("/characters/{character_id}", status_code=204)
def delete_character(character_id: int, db: Session = Depends(get_db)):
    character = get_character_or_404(character_id, db)
    db.delete(character)
    db.commit()
