# Обновление афиши

Сайт продолжает читать `data/movies.json`.
Обновляющий скрипт теперь умеет работать в двух режимах:

1. Локальный источник: `data/movies.source.json`
2. Google Sheets

## Локальный режим

1. Отредактируйте `data/movies.source.json`
2. Запустите:

```bash
npm run update-movies
```

Если переменные Google Sheets не заданы, скрипт автоматически использует локальный JSON.

## Google Sheets

Скрипт может читать данные из Google Sheets без секретов, если таблица опубликована или доступна по ссылке для чтения.

### Какие колонки нужны

В таблице должна быть строка заголовков. Обязательные колонки:

- `id`
- `title`
- `description`
- `genre`
- `age`
- `duration`
- `poster`
- `price`
- `sessions`

Допустимы и русские названия колонок:

- `название`
- `описание`
- `жанр`
- `возраст`
- `длительность`
- `постер`
- `цена`
- `сеансы`

### Варианты конфигурации

Предпочтительный вариант:

- `GOOGLE_SHEETS_CSV_URL`

Либо:

- `GOOGLE_SHEETS_ID`
- `GOOGLE_SHEETS_GID`

Либо:

- `GOOGLE_SHEETS_ID`
- `GOOGLE_SHEETS_SHEET_NAME`

Дополнительно можно явно включить режим:

- `MOVIES_SOURCE=google-sheets`

Если `MOVIES_SOURCE` не указан, но Google-конфигурация есть, скрипт сам переключится на Google Sheets.

### Примеры запуска

PowerShell:

```powershell
$env:MOVIES_SOURCE="google-sheets"
$env:GOOGLE_SHEETS_CSV_URL="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0"
npm run update-movies
```

Или через `ID + GID`:

```powershell
$env:MOVIES_SOURCE="google-sheets"
$env:GOOGLE_SHEETS_ID="your-sheet-id"
$env:GOOGLE_SHEETS_GID="0"
npm run update-movies
```

## Что делает скрипт

- получает строки из источника
- нормализует поля
- валидирует обязательные значения
- собирает `data/movies.json` в текущем формате сайта

## Примечания

- Локальный `data/movies.source.json` остаётся как fallback и удобный режим для ручной работы.
- Формат `data/movies.json` не меняется, поэтому фронтенд продолжает работать без правок.
- Для загрузки `data/movies.json` в браузере сайт нужно запускать через локальный сервер, а не через `file://`.
