"""Multi-provider LLM layer.

Two wire protocols are supported:
  - Anthropic (native SDK, with prompt caching and adaptive thinking)
  - OpenAI-compatible Chat Completions (OpenAI, OpenRouter, Groq, xAI/Grok,
    NVIDIA NIM, Hugging Face router, Ollama, or any custom endpoint)

Each task (chat, structure, edit, summary) can be routed to a different
provider+model, stored in the `ai_settings` table and editable from the UI.
"""

import json
import os
import re

import anthropic
import openai as openai_sdk
from fastapi import HTTPException
from openai import OpenAI
from sqlalchemy.orm import Session

from .models import AISetting

TASKS = {
    "chat": "Asistente de chat",
    "structure": "Generación de estructura",
    "edit": "Edición de fragmentos",
    "summary": "Informe de la historia",
}

PROVIDERS: dict[str, dict] = {
    "anthropic": {
        "label": "Anthropic (Claude)",
        "type": "anthropic",
        "env": "ANTHROPIC_API_KEY",
        "default_model": "claude-opus-4-8",
        "suggested_models": ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
    },
    "openai": {
        "label": "OpenAI",
        "type": "openai",
        "env": "OPENAI_API_KEY",
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o",
        "suggested_models": ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
    },
    "openrouter": {
        "label": "OpenRouter",
        "type": "openai",
        "env": "OPENROUTER_API_KEY",
        "base_url": "https://openrouter.ai/api/v1",
        "default_model": "anthropic/claude-sonnet-4.6",
        "suggested_models": [
            "anthropic/claude-sonnet-4.6",
            "openai/gpt-4o",
            "meta-llama/llama-3.3-70b-instruct",
            "deepseek/deepseek-chat",
        ],
    },
    "groq": {
        "label": "Groq",
        "type": "openai",
        "env": "GROQ_API_KEY",
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.3-70b-versatile",
        "suggested_models": ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
    },
    "xai": {
        "label": "xAI (Grok)",
        "type": "openai",
        "env": "XAI_API_KEY",
        "base_url": "https://api.x.ai/v1",
        "default_model": "grok-3",
        "suggested_models": ["grok-3", "grok-3-mini"],
    },
    "nvidia": {
        "label": "NVIDIA NIM",
        "type": "openai",
        "env": "NVIDIA_API_KEY",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "default_model": "meta/llama-3.3-70b-instruct",
        "suggested_models": [
            "meta/llama-3.3-70b-instruct",
            "nvidia/llama-3.1-nemotron-70b-instruct",
        ],
    },
    "huggingface": {
        "label": "Hugging Face",
        "type": "openai",
        "env": "HF_TOKEN",
        "base_url": "https://router.huggingface.co/v1",
        "default_model": "meta-llama/Llama-3.3-70B-Instruct",
        "suggested_models": [
            "meta-llama/Llama-3.3-70B-Instruct",
            "Qwen/Qwen2.5-72B-Instruct",
        ],
    },
    "ollama": {
        "label": "Ollama (local)",
        "type": "openai",
        "env": "OLLAMA_API_KEY",
        "base_url_env": "OLLAMA_BASE_URL",
        "base_url": "http://host.docker.internal:11434/v1",
        "default_model": "llama3.1",
        "suggested_models": ["llama3.1", "mistral", "qwen2.5"],
        "requires_key": False,
    },
    "custom": {
        "label": "Endpoint personalizado (compatible OpenAI)",
        "type": "openai",
        "env": "CUSTOM_OPENAI_API_KEY",
        "base_url_env": "CUSTOM_OPENAI_BASE_URL",
        "base_url": "",
        "default_model": "",
        "suggested_models": [],
        "requires_key": False,
    },
}

# Order used to pick a default provider when none is configured for a task.
PROVIDER_PRIORITY = [
    "anthropic", "openai", "openrouter", "groq", "xai", "nvidia",
    "huggingface", "ollama", "custom",
]


def _base_url(cfg: dict) -> str:
    env_name = cfg.get("base_url_env")
    if env_name and os.getenv(env_name):
        return os.getenv(env_name, "")
    return cfg.get("base_url", "")


def is_configured(provider_id: str) -> bool:
    cfg = PROVIDERS[provider_id]
    if cfg.get("requires_key", True):
        return bool(os.getenv(cfg["env"]))
    # Keyless providers (ollama, custom) opt in by setting their base-URL variable.
    return bool(os.getenv(cfg.get("base_url_env", "")))


def providers_info() -> list[dict]:
    return [
        {
            "id": pid,
            "label": cfg["label"],
            "configured": is_configured(pid),
            "requires_key": cfg.get("requires_key", True),
            "env": cfg["env"],
            "default_model": cfg["default_model"],
            "suggested_models": cfg["suggested_models"],
        }
        for pid, cfg in PROVIDERS.items()
    ]


def default_provider() -> str | None:
    for pid in PROVIDER_PRIORITY:
        if is_configured(pid):
            return pid
    return None


def resolve(db: Session, task: str) -> tuple[str, str]:
    """Return (provider_id, model) for a task, falling back to defaults."""
    setting = db.query(AISetting).filter_by(task=task).first()
    if setting and setting.provider in PROVIDERS and is_configured(setting.provider):
        model = setting.model or PROVIDERS[setting.provider]["default_model"]
        if model:
            return setting.provider, model
    pid = default_provider()
    if pid is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Ningún proveedor de IA está configurado. Añade al menos una clave "
                "(ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, "
                "XAI_API_KEY, NVIDIA_API_KEY, HF_TOKEN…) al archivo .env y reinicia el backend."
            ),
        )
    model = PROVIDERS[pid]["default_model"]
    if not model:
        raise HTTPException(
            status_code=503,
            detail=f"El proveedor '{pid}' no tiene modelo por defecto: elige uno en Configuración IA.",
        )
    return pid, model


def complete(
    db: Session,
    task: str,
    system_base: str,
    context: str,
    messages: list[dict],
    max_tokens: int = 8000,
    schema: dict | None = None,
) -> str:
    """Run a completion for `task` with whatever provider+model is configured.

    `messages` follows the shared {role, content} shape (user/assistant turns).
    When `schema` is given the return value is a JSON string matching it.
    """
    provider_id, model = resolve(db, task)
    cfg = PROVIDERS[provider_id]
    if cfg["type"] == "anthropic":
        return _complete_anthropic(model, system_base, context, messages, max_tokens, schema)
    return _complete_openai(provider_id, cfg, model, system_base, context, messages, max_tokens, schema)


# ---------- Anthropic ----------

def _complete_anthropic(
    model: str, system_base: str, context: str, messages: list[dict],
    max_tokens: int, schema: dict | None,
) -> str:
    client = anthropic.Anthropic()
    # Stable instructions first; the project context is the cached prefix breakpoint.
    system = [
        {"type": "text", "text": system_base},
        {
            "type": "text",
            "text": f"CONTEXTO DEL PROYECTO:\n{context}",
            "cache_control": {"type": "ephemeral"},
        },
    ]
    if schema is not None:
        response = client.messages.create(
            model=model,
            max_tokens=max(max_tokens, 16000),
            system=system,
            messages=messages,
            output_config={"format": {"type": "json_schema", "schema": schema}},
        )
        return _anthropic_text(response)

    with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        thinking={"type": "adaptive"},
        system=system,
        messages=messages,
    ) as stream:
        message = stream.get_final_message()
    return _anthropic_text(message)


def _anthropic_text(message) -> str:
    if message.stop_reason == "refusal":
        raise HTTPException(status_code=422, detail="El modelo declinó esta petición.")
    text = "".join(block.text for block in message.content if block.type == "text")
    if not text:
        raise HTTPException(status_code=502, detail="El modelo no devolvió texto.")
    return text


# ---------- OpenAI-compatible ----------

def _complete_openai(
    provider_id: str, cfg: dict, model: str, system_base: str, context: str,
    messages: list[dict], max_tokens: int, schema: dict | None,
) -> str:
    base_url = _base_url(cfg)
    if not base_url:
        raise HTTPException(
            status_code=503,
            detail=f"Define la URL base del proveedor '{provider_id}' (variable {cfg.get('base_url_env')}).",
        )
    api_key = os.getenv(cfg["env"]) or "not-needed"
    client = OpenAI(base_url=base_url, api_key=api_key, timeout=600)

    system_text = f"{system_base}\n\nCONTEXTO DEL PROYECTO:\n{context}"
    if schema is not None:
        # Not every compatible provider implements response_format=json_schema,
        # so we instruct JSON-only output and parse defensively.
        system_text += (
            "\n\nIMPORTANTE: responde ÚNICAMENTE con un objeto JSON válido (sin markdown, "
            "sin ```json, sin texto adicional) que cumpla exactamente este esquema:\n"
            + json.dumps(schema, ensure_ascii=False)
        )

    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system_text}, *messages],
    )
    if not response.choices:
        raise HTTPException(status_code=502, detail="El modelo no devolvió respuesta.")
    text = response.choices[0].message.content or ""
    if not text.strip():
        raise HTTPException(status_code=502, detail="El modelo no devolvió texto.")
    if schema is not None:
        return extract_json(text)
    return text.strip()


def extract_json(text: str) -> str:
    """Return the JSON object embedded in `text`, tolerating markdown fences and prose."""
    candidates = [text.strip()]
    fenced = re.findall(r"```(?:json)?\s*(.*?)```", text, flags=re.DOTALL)
    candidates.extend(f.strip() for f in fenced)
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])
    for candidate in candidates:
        try:
            json.loads(candidate)
            return candidate
        except (json.JSONDecodeError, ValueError):
            continue
    raise HTTPException(
        status_code=502,
        detail="El modelo no devolvió JSON válido. Prueba con otro modelo para la tarea de estructura.",
    )


def handle_ai_errors(fn):
    """Decorator translating SDK errors (Anthropic and OpenAI-compatible) into HTTP responses."""
    from functools import wraps

    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except HTTPException:
            raise
        except (anthropic.AuthenticationError, openai_sdk.AuthenticationError):
            raise HTTPException(status_code=503, detail="La clave de API del proveedor seleccionado no es válida.")
        except (anthropic.RateLimitError, openai_sdk.RateLimitError):
            raise HTTPException(status_code=429, detail="Límite de peticiones del proveedor alcanzado. Inténtalo en unos segundos.")
        except anthropic.APIStatusError as e:
            raise HTTPException(status_code=502, detail=f"Error de la API de Anthropic: {e.message}")
        except openai_sdk.APIStatusError as e:
            raise HTTPException(status_code=502, detail=f"Error del proveedor de IA: {getattr(e, 'message', str(e))}")
        except (anthropic.APIConnectionError, openai_sdk.APIConnectionError):
            raise HTTPException(status_code=502, detail="No se pudo conectar con el proveedor de IA.")

    return wrapper
