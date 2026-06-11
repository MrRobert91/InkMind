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
- **Historial de versiones**: guardado automático al cambiar el contenido, hitos manuales, vista previa y restauración (la restauración también es reversible).
- **Informe del estado de la historia**: análisis tipo editor con fortalezas, riesgos y próximos pasos.

## Arquitectura

Cada servicio corre en su propio contenedor Docker:

| Servicio   | Tecnología                          | Puerto |
|------------|-------------------------------------|--------|
| `frontend` | React + Vite + TypeScript, servido por nginx (proxy `/api` → backend) | 3000 |
| `backend`  | FastAPI + SQLAlchemy + SDK de Anthropic (`claude-opus-4-8`) | 8000 |
| `db`       | PostgreSQL 16                        | interno |

## Puesta en marcha

Requisitos: Docker y Docker Compose.

```bash
# 1. Configura tu clave de la API de Anthropic
cp .env.example .env
# edita .env y pon tu ANTHROPIC_API_KEY

# 2. Levanta los tres contenedores
docker compose up --build
```

- Aplicación: http://localhost:3000
- API y documentación interactiva: http://localhost:8000/docs
- Comprobación de estado: http://localhost:8000/api/health

Sin `ANTHROPIC_API_KEY` la aplicación funciona como organizador (proyectos, capítulos, personajes, versiones); las funciones de IA devuelven un aviso de configuración.

## Desarrollo local sin Docker

```bash
# Backend (necesita un PostgreSQL accesible en DATABASE_URL)
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql://inkmind:inkmind@localhost:5432/inkmind uvicorn app.main:app --reload

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
    database.py      # SQLAlchemy + espera de la base de datos
    models.py        # Project, Chapter, ChapterVersion, Character, ChatMessage
    schemas.py       # Esquemas Pydantic
    ai_service.py    # Copiloto IA: contexto narrativo, chat, estructura, edición, informes
    routers/         # projects, chapters (+versiones), characters, ai
frontend/
  src/
    pages/           # Dashboard, Panel, Tablero, Editor, Personajes, Chat
    api.ts           # Cliente de la API
docker-compose.yml   # db + backend + frontend
```

## Hoja de ruta (post-MVP)

Grafo narrativo interactivo, línea temporal, curva de tensión, detección automática de contradicciones, modo saga/universo compartido, exportación a PDF/EPUB/DOCX, colaboración multiautor y biblioteca de tropos.
