# University Schema Onboarding Runbook

Процесс добавления нового вуза в semi-auto flow (extension + JSON schema).

## Scope

- **Автоматизируем:** fill полей wizard + upload файлов
- **Вручную (консультант):** login, капча, CSRF, agree, выбор программы, submit
- **Не делаем:** универсальный движок "любой вуз"

Целевой пул: топ-20–50 вузов по объёму заявок (Парето).

---

## Pipeline (4 шага)

```
1. Capture DOM   →  JSON per wizard step
2. LLM draft     →  university-schema.draft.json
3. Human review  →  fix selectors/mapsTo
4. Seed + test   →  extension smoke on real form
```

---

## Step 1 — DOM Capture

1. Консультант логинится на форму вуза в обычном Chrome
2. Доходит до **первого шага wizard** (или single-page form)
3. DevTools → Console → вставить содержимое [`scripts/dom-field-capture.js`](../scripts/dom-field-capture.js)
4. JSON копируется в clipboard → сохранить как `data/captures/<university-id>/step-1.json`
5. Нажать Next → повторить для каждого шага
6. Для upload step — capture на шаге с file inputs

**Формат capture** (один объект на шаг):

```json
{
  "url": "https://...",
  "capturedAt": "2026-...",
  "wizardStep": 1,
  "wizardStepTitle": "Basic Info",
  "fields": [
    {
      "tag": "input",
      "inputType": "text",
      "name": "apply.lastName",
      "label": "Family Name",
      "selector": "input[name=\"apply.lastName\"]",
      "required": true
    }
  ],
  "fileInputs": [],
  "navigation": {
    "nextButtonSelector": "input[value=\"Save and Next\"]"
  }
}
```

---

## Step 2 — LLM Draft Generation

### Вариант A: CLI (без запущенного API)

```bash
node scripts/generate-university-schema.mjs \
  --capture data/captures/my-uni/step-1.json \
  --capture data/captures/my-uni/step-2.json \
  --id my-university \
  --display-name "My University" \
  --form-url "https://apply.example.edu/form" \
  --alias "My Uni" \
  --out data/university-schemas/my-university.draft.json
```

Требует `GEMINI_API_KEY` в `apps/api/.env`.

### Вариант B: API endpoint

```bash
curl -X POST http://localhost:3000/universities/schemas/generate-draft \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-university",
    "displayName": "My University",
    "formUrl": "https://apply.example.edu/form",
    "captures": [ ...step JSONs... ]
  }'
```

Response:

```json
{
  "schema": { ...UniversitySchema },
  "warnings": ["File field ... has no documentType"],
  "model": "gemini-3.5-flash"
}
```

Env: `GEMINI_SCHEMA_MODEL` (optional, defaults to `GEMINI_LETTER_MODEL`).

---

## Step 3 — Human Review Checklist

- [ ] `formUrl` — точный URL после login (origin+pathname match в API)
- [ ] `wizard.totalSteps` совпадает с реальным числом шагов
- [ ] `selector` — проверить в DevTools `document.querySelector(...)`
- [ ] `mapsTo` — surname/givenName/email/passport не перепутаны
- [ ] `type: file` + `documentType` — photo/passport/transcript/medical/financial
- [ ] `type: essay` — motivation/study plan, `mapsTo: null`
- [ ] `required` — только реально обязательные поля
- [ ] pre-wizard шаги описаны в `notes` (не автоматизируются)

Переименовать `*.draft.json` → `*.json` после ревью.

---

## Step 4 — Seed + Smoke Test

```bash
# Seed DB from JSON files
curl -X POST http://localhost:3000/universities/schemas/seed

# Dashboard: создать batch → Открыть форму
# Extension side panel: зелёные/красные поля
# Ручной submit на сайте вуза
```

---

## Что LLM делает / не делает

| Делает | Не делает |
|--------|-----------|
| Маппит label → mapsTo | Гарантировать 100% селекторы |
| Предлагает wizard config | Пройти login/pre-wizard |
| Классифицирует file/essay/select | Заменить human review |
| Черновик за минуты | Масштаб на все вузы мира |

---

## Добавление N-го вуза быстрее первого

1. Копируешь capture script — тот же
2. Копируешь CLI команду — меняешь id/captures
3. Сверяешь с похожим вузом (тот же vendor: 17gz.org, applyboard, etc.)
4. Переиспользуешь wizard navigation patterns из `zhengzhou-university.json`

---

## Files

| File | Role |
|------|------|
| `scripts/dom-field-capture.js` | Browser console capture |
| `scripts/generate-university-schema.mjs` | CLI → Gemini → draft JSON |
| `POST /universities/schemas/generate-draft` | API → Gemini → draft JSON |
| `data/university-schemas/*.json` | Production schemas |
| `data/captures/<id>/step-*.json` | Raw DOM captures (gitignore optional) |
