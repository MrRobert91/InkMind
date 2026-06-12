"""Narrative AI copilot.

Builds the prompts and structured project context (premise, framework,
characters, chapter map) and delegates the actual model call to `llm.py`,
which routes each task to whatever provider+model the user configured.
"""

import json

from sqlalchemy.orm import Session

from . import llm
from .llm import handle_ai_errors  # re-exported for the routers  # noqa: F401
from .models import Chapter, Project

FRAMEWORKS = {
    "three_acts": "Estructura en tres actos: planteamiento, confrontación y resolución.",
    "hero_journey": "El viaje del héroe: separación, iniciación y retorno (12 etapas de Campbell/Vogler).",
    "save_the_cat": "Save the Cat: hoja de 15 beats de Blake Snyder.",
    "snowflake": "Método Snowflake: expansión desde una frase central hacia capas cada vez más detalladas.",
    "mystery": "Estructura de misterio: control de pistas, sospechosos y revelaciones al lector.",
    "custom": "Estructura personalizada definida por el autor.",
}

EDIT_ACTIONS = {
    "expand": "Expande este fragmento con más detalle sensorial y narrativo, manteniendo la voz del autor.",
    "summarize": "Resume este fragmento conservando la información esencial para la trama.",
    "tone": "Reescribe este fragmento ajustando el tono según las instrucciones (o el tono general de la obra si no hay instrucciones).",
    "tension": "Reescribe este fragmento aumentando la tensión dramática, sin que los personajes verbalicen explícitamente lo que sienten.",
    "dialogue": "Convierte la exposición de este fragmento en diálogo y acción.",
    "poetic": "Reescribe este fragmento con un tono más poético y evocador, sin caer en lo recargado.",
    "subtle": "Haz este fragmento más sutil: muestra en lugar de contar, elimina lo obvio.",
    "rhythm": "Mejora el ritmo de este fragmento: varía la longitud de las frases y elimina repeticiones.",
    "alternatives": "Propón tres alternativas distintas para este fragmento, numeradas, cada una con un enfoque diferente.",
    "analyze": "Analiza qué función cumple este fragmento dentro de la historia y señala posibles problemas (exposición excesiva, falta de conflicto, incoherencias).",
}

SYSTEM_BASE = """Eres InkMind, un copiloto narrativo para escritores de relatos y novelas. \
Actúas como mentor creativo, editor literario, estructurador narrativo, analista de coherencia y lector beta. \
Nunca sustituyes al autor: propones opciones, haces preguntas, detectas problemas y sugieres mejoras, \
pero el control creativo siempre es suyo. Responde siempre en el idioma del autor (por defecto español). \
Sé concreto y útil: cuando propongas alternativas, numéralas; cuando detectes un problema, explica por qué lo es \
y cómo podría resolverse. Usa la información del proyecto que se te proporciona y mantén la coherencia con ella."""


def build_project_context(project: Project, current_chapter: Chapter | None = None) -> str:
    """Serialize the project's narrative memory for the system prompt."""
    lines = [
        f"TÍTULO: {project.title}",
        f"GÉNERO: {project.genre or 'sin definir'}",
        f"TONO: {project.tone or 'sin definir'}",
        f"PÚBLICO: {project.audience or 'sin definir'}",
        f"PREMISA: {project.premise or 'sin definir'}",
        f"TEMA CENTRAL: {project.theme or 'sin definir'}",
        f"ESTRUCTURA NARRATIVA: {FRAMEWORKS.get(project.framework, project.framework)}",
    ]
    if project.world_notes:
        lines.append(f"NOTAS DEL MUNDO:\n{project.world_notes[:4000]}")

    if project.characters:
        lines.append("\nPERSONAJES:")
        for c in project.characters:
            parts = [f"- {c.name} ({c.role or 'rol sin definir'})"]
            if c.description:
                parts.append(f"  Descripción: {c.description[:500]}")
            if c.external_desire:
                parts.append(f"  Deseo externo: {c.external_desire[:300]}")
            if c.internal_need:
                parts.append(f"  Necesidad interna: {c.internal_need[:300]}")
            if c.fear:
                parts.append(f"  Miedo: {c.fear[:300]}")
            if c.secrets:
                parts.append(f"  Secretos: {c.secrets[:300]}")
            if c.arc:
                parts.append(f"  Arco: {c.arc[:300]}")
            lines.append("\n".join(parts))

    if project.chapters:
        lines.append("\nMAPA DE CAPÍTULOS:")
        for ch in project.chapters:
            words = len(ch.content.split()) if ch.content else 0
            lines.append(
                f"- Cap. {ch.order_index + 1}: {ch.title} [{ch.status}, {words} palabras]"
                + (f" — {ch.summary[:400]}" if ch.summary else "")
                + (f" | Conflicto: {ch.conflict[:200]}" if ch.conflict else "")
            )

    if current_chapter is not None:
        lines.append(f"\nCAPÍTULO EN EL QUE TRABAJA AHORA EL AUTOR: {current_chapter.title}")
        if current_chapter.content:
            lines.append(f"TEXTO ACTUAL DEL CAPÍTULO (puede estar truncado):\n{current_chapter.content[:12000]}")

    return "\n".join(lines)


def chat_reply(
    db: Session, project: Project, history: list[dict], current_chapter: Chapter | None = None
) -> str:
    """Project-aware chat. `history` is a list of {role, content} dicts ending with the user turn."""
    context = build_project_context(project, current_chapter)
    return llm.complete(db, "chat", SYSTEM_BASE, context, history[-30:], max_tokens=8000)


STRUCTURE_SCHEMA = {
    "type": "object",
    "properties": {
        "chapters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "conflict": {"type": "string"},
                    "emotion": {"type": "string"},
                    "narrative_function": {"type": "string"},
                },
                "required": ["title", "summary", "conflict", "emotion", "narrative_function"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["chapters"],
    "additionalProperties": False,
}


def generate_structure(
    db: Session, project: Project, framework: str, num_chapters: int | None, instructions: str
) -> list[dict]:
    """Generate an editable chapter map following the chosen narrative framework."""
    context = build_project_context(project)
    framework_desc = FRAMEWORKS.get(framework, framework)
    target = (
        f"aproximadamente {num_chapters} capítulos"
        if num_chapters
        else "el número de capítulos que mejor sirva a la historia (entre 8 y 20)"
    )

    prompt = (
        f"Genera un esquema de capítulos para esta obra usando la estructura: {framework_desc}\n"
        f"Crea {target}. Para cada capítulo define: título evocador, resumen de lo que ocurre (2-4 frases), "
        f"conflicto principal, emoción dominante y función narrativa dentro de la estructura elegida "
        f"(por ejemplo, a qué beat o etapa corresponde).\n"
        f"El esquema debe ser coherente con la premisa, los personajes y los capítulos ya existentes."
    )
    if instructions:
        prompt += f"\nInstrucciones adicionales del autor: {instructions}"

    raw = llm.complete(
        db, "structure", SYSTEM_BASE, context,
        [{"role": "user", "content": prompt}],
        max_tokens=16000,
        schema=STRUCTURE_SCHEMA,
    )
    data = json.loads(raw)
    return data["chapters"]


def edit_fragment(
    db: Session, project: Project, fragment: str, action: str, instructions: str, chapter: Chapter | None
) -> str:
    """Apply a targeted editorial action to a selected fragment."""
    context = build_project_context(project, chapter)
    action_prompt = EDIT_ACTIONS.get(action, action)

    prompt = (
        f"ACCIÓN EDITORIAL: {action_prompt}\n"
        + (f"INSTRUCCIONES DEL AUTOR: {instructions}\n" if instructions else "")
        + f"\nFRAGMENTO:\n<<<\n{fragment}\n>>>\n\n"
    )
    if action in ("alternatives", "analyze"):
        prompt += "Responde con el análisis o las alternativas solicitadas."
    else:
        prompt += (
            "Responde ÚNICAMENTE con el fragmento reescrito, sin preámbulos, sin comillas "
            "y sin comentarios adicionales, para que pueda sustituir directamente al original."
        )

    return llm.complete(
        db, "edit", SYSTEM_BASE, context, [{"role": "user", "content": prompt}], max_tokens=8000
    )


def story_summary(db: Session, project: Project) -> str:
    """Editor-style report on the current state of the story."""
    context = build_project_context(project)
    prompt = (
        "Actúa como editor literario y genera un informe del estado actual de esta historia:\n"
        "1. Resumen de lo que existe hasta ahora.\n"
        "2. Fortalezas detectadas.\n"
        "3. Problemas o riesgos (capítulos sin conflicto, personajes desaparecidos, "
        "promesas narrativas abiertas, posibles incoherencias).\n"
        "4. Próximos pasos sugeridos (3-5 tareas concretas).\n"
        "Sé honesto y específico; cita capítulos y personajes por su nombre."
    )
    return llm.complete(
        db, "summary", SYSTEM_BASE, context, [{"role": "user", "content": prompt}], max_tokens=10000
    )
