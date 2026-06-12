from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ---------- Projects ----------

class ProjectBase(BaseModel):
    title: str
    genre: str = ""
    tone: str = ""
    audience: str = ""
    premise: str = ""
    theme: str = ""
    framework: str = "three_acts"
    status: str = "idea"
    world_notes: str = ""


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    genre: Optional[str] = None
    tone: Optional[str] = None
    audience: Optional[str] = None
    premise: Optional[str] = None
    theme: Optional[str] = None
    framework: Optional[str] = None
    status: Optional[str] = None
    world_notes: Optional[str] = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    chapter_count: int = 0
    character_count: int = 0
    word_count: int = 0


# ---------- Chapters ----------

class ChapterBase(BaseModel):
    title: str
    summary: str = ""
    content: str = ""
    status: str = "outline"
    conflict: str = ""
    emotion: str = ""
    narrative_function: str = ""


class ChapterCreate(ChapterBase):
    pass


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    conflict: Optional[str] = None
    emotion: Optional[str] = None
    narrative_function: Optional[str] = None
    version_note: Optional[str] = None


class ChapterOut(ChapterBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    order_index: int
    created_at: datetime
    updated_at: datetime


class ChapterReorder(BaseModel):
    chapter_ids: list[int]


# ---------- Versions ----------

class VersionCreate(BaseModel):
    note: str = ""


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chapter_id: int
    title: str
    content: str
    note: str
    origin: str
    created_at: datetime


# ---------- Characters ----------

class CharacterBase(BaseModel):
    name: str
    role: str = ""
    description: str = ""
    external_desire: str = ""
    internal_need: str = ""
    fear: str = ""
    wound: str = ""
    voice: str = ""
    secrets: str = ""
    arc: str = ""
    relationships: str = ""


class CharacterCreate(CharacterBase):
    pass


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    description: Optional[str] = None
    external_desire: Optional[str] = None
    internal_need: Optional[str] = None
    fear: Optional[str] = None
    wound: Optional[str] = None
    voice: Optional[str] = None
    secrets: Optional[str] = None
    arc: Optional[str] = None
    relationships: Optional[str] = None


class CharacterOut(CharacterBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    created_at: datetime


# ---------- Chat ----------

class ChatMessageIn(BaseModel):
    content: str
    chapter_id: Optional[int] = None


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    created_at: datetime


# ---------- AI ----------

class GenerateStructureIn(BaseModel):
    framework: Optional[str] = None
    num_chapters: Optional[int] = None
    instructions: str = ""


class EditFragmentIn(BaseModel):
    fragment: str
    action: str
    instructions: str = ""
    chapter_id: Optional[int] = None


class EditFragmentOut(BaseModel):
    result: str


class StorySummaryOut(BaseModel):
    summary: str
