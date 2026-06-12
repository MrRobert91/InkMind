# InkMind — Copiloto narrativo con IA

Plataforma de escritura creativa asistida por IA para relatos y novelas. No genera historias completas a partir de un prompt: acompaña al autor durante todo el proceso (idea → planificación → escritura → revisión), manteniendo siempre el control creativo en sus manos.

## Funcionalidades (MVP)

- **Proyectos narrativos** con ficha de obra: premisa, género, tono, tema, público, estado y notas del mundo.
- **Frameworks narrativos**: tres actos, viaje del héroe, Save the Cat, Snowflake, misterio o estructura personalizada.
- **Generación de estructura con IA**: esquema de capítulos editable (título, resumen, conflicto, emoción y función narrativa) adaptado al framework elegido.
- **Tablero de capítulos**: tarjetas arrastrables para reorganizar la historia.
- **Editor de capítulos** con ficha de escena (resumen, conflicto, emoción, función narrativa).
- **Edición inteligente de fragmentos**: selecciona texto y pide expandir, resumir, cambiar tono, añadir tensión, convertir en diálogo, proponer alternativas o analizar la función del fragmento. Tú decides si sustituyes el original.
- **Biblioteca de personajes**: fichas vivas con deseo externo, necesidad interna, miedo, herida, voz, secretos, arco y relaciones.
- **Chat IA contextual por proyecto**: el asistente conoce la premisa, los personajes y el mapa de capítulos.
- **Multi-proveedor de IA con modelo por tarea**: Anthropic (Claude), OpenAI, OpenRouter, Groq, xAI (Grok), NVIDIA NIM, Hugging Face, Ollama local o cualquier endpoint compatible con la API de OpenAI. Desde la página «Configuración IA» eliges qué proveedor y qué modelo ejecuta cada tarea (chat, estructura, edición de fragmentos, informe).
- **Historial de versiones**: guardado automático al cambiar el contenido, hitos manuales, vista previa y restauración (la restauración también es reversible).
- **Informe del estado de la historia**: análisis tipo editor con fortalezas, riesgos y próximos pasos.

## Arquitectura

Cada servicio corre en su propio contenedor Docker:

| Servicio   | Tecnología                          | Puerto |
|------------|-------------------------------------|--------|
| `frontend` | React + Vite + TypeScript, servido por nginx (proxy `/api` → backend) | 3000 |
| `backend`  | FastAPI + SQLAlchemy + **SQLite** (persistido en el volumen `inkmind_data`) + capa LLM multi-proveedor | 8000 |

La base de datos es SQLite embebida en el backend (un servicio menos que levantar). El archivo vive en el volumen Docker `inkmind_data`, así que los datos sobreviven a reinicios y reconstrucciones.

### Proveedores de IA soportados

| Proveedor | Variable de entorno | Protocolo |
|-----------|--------------------|-----------|
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | SDK nativo (caché de prompt + thinking adaptativo) |
| OpenAI | `OPENAI_API_KEY` | Chat Completions |
| OpenRouter | `OPENROUTER_API_KEY` | Chat Completions |
| Groq | `GROQ_API_KEY` | Chat Completions |
| xAI (Grok) | `XAI_API_KEY` | Chat Completions |
| NVIDIA NIM | `NVIDIA_API_KEY` | Chat Completions |
| Hugging Face | `HF_TOKEN` | Chat Completions (router) |
| Ollama (local) | `OLLAMA_BASE_URL` (sin clave) | Chat Completions |
| Personalizado | `CUSTOM_OPENAI_BASE_URL` (+ clave opcional) | Chat Completions |

En **Configuración IA** (`/settings`) se asigna proveedor + modelo a cada tarea: chat, generación de estructura, edición de fragmentos e informe de la historia. El campo de modelo es libre (con sugerencias), así que cualquier modelo del proveedor funciona.

## Puesta en marcha

Requisitos: Docker y Docker Compose.

```bash
# 1. Configura al menos un proveedor de IA
cp .env.example .env
# edita .env y rellena la(s) clave(s) que tengas

# 2. Levanta los dos contenedores
docker compose up --build
```

- Aplicación: http://localhost:3000
- API y documentación interactiva: http://localhost:8000/docs
- Comprobación de estado: http://localhost:8000/api/health

Sin ninguna clave de proveedor la aplicación funciona como organizador (proyectos, capítulos, personajes, versiones); las funciones de IA devuelven un aviso de configuración.

## Desarrollo local sin Docker

```bash
# Backend (SQLite se crea automáticamente como ./inkmind.db)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (proxy /api -> http://localhost:8000)
cd frontend
npm install
npm run dev
```

## Estructura del repositorio

```
backend/
  app/
    main.py          # FastAPI, CORS, creación de tablas
    database.py      # SQLAlchemy + SQLite
    models.py        # Project, Chapter, ChapterVersion, Character, ChatMessage, AISetting
    schemas.py       # Esquemas Pydantic
    llm.py           # Capa multi-proveedor (Anthropic + compatibles OpenAI) y enrutado por tarea
    ai_service.py    # Copiloto IA: contexto narrativo, prompts de chat/estructura/edición/informe
    routers/         # projects, chapters (+versiones), characters, ai (+providers/task-settings)
frontend/
  src/
    pages/           # Dashboard, Panel, Tablero, Editor, Personajes, Chat, Configuración IA
    api.ts           # Cliente de la API
docker-compose.yml   # backend (SQLite embebido) + frontend
```

## Hoja de ruta (post-MVP)

Grafo narrativo interactivo, línea temporal, curva de tensión, detección automática de contradicciones, modo saga/universo compartido, exportación a PDF/EPUB/DOCX, colaboración multiautor y biblioteca de tropos.
