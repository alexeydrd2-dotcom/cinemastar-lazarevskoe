import { get } from "node:https";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const rootDir = resolve(dirname(currentFilePath), "..");
const sourcePath = resolve(rootDir, "data", "movies.source.json");
const outputPath = resolve(rootDir, "data", "movies.json");
const googleSheetsCsvUrl = process.env.GOOGLE_SHEETS_CSV_URL?.trim() || "";
const googleSheetsId = process.env.GOOGLE_SHEETS_ID?.trim() || "";
const googleSheetsGid = process.env.GOOGLE_SHEETS_GID?.trim() || "";
const googleSheetsSheetName = process.env.GOOGLE_SHEETS_SHEET_NAME?.trim() || "";
const sourceMode = process.env.MOVIES_SOURCE?.trim().toLowerCase() || "";

const REQUIRED_FIELDS = [
  "id",
  "title",
  "description",
  "genre",
  "age",
  "duration",
  "poster",
  "price"
];

const REQUIRED_COLUMNS = [...REQUIRED_FIELDS, "sessions"];

const FIELD_ALIASES = {
  id: ["id", "movieid", "ид", "idфильма"],
  title: ["title", "название", "фильм", "movie"],
  description: ["description", "описание", "desc", "summary"],
  genre: ["genre", "жанр"],
  age: ["age", "возраст", "agerating"],
  duration: ["duration", "длительность", "time", "runtime"],
  poster: ["poster", "постер", "posterurl", "image", "imageurl"],
  price: ["price", "цена", "cost"],
  sessions: ["sessions", "сеансы", "sessiontimes", "times", "showtimes"]
};

function normalizeString(value, fieldName, movieId) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Movie "${movieId}": field "${fieldName}" must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeSessions(value, movieId) {
  if (Array.isArray(value)) {
    const sessions = value
      .map((session) => (typeof session === "string" ? session.trim() : ""))
      .filter(Boolean);

    if (!sessions.length) {
      throw new Error(`Movie "${movieId}": field "sessions" must contain at least one session.`);
    }

    return sessions;
  }

  if (typeof value === "string" && value.trim()) {
    const sessions = value
      .split(/\s*[,/]\s*/)
      .map((session) => session.trim())
      .filter(Boolean);

    if (!sessions.length) {
      throw new Error(`Movie "${movieId}": field "sessions" must contain at least one session.`);
    }

    return sessions;
  }

  throw new Error(`Movie "${movieId}": field "sessions" must be an array or string.`);
}

function normalizeMovie(rawMovie, index) {
  if (!rawMovie || typeof rawMovie !== "object" || Array.isArray(rawMovie)) {
    throw new Error(`Movie at index ${index} must be an object.`);
  }

  const movieId = typeof rawMovie.id === "string" && rawMovie.id.trim()
    ? rawMovie.id.trim()
    : `movie-${index + 1}`;

  for (const field of REQUIRED_FIELDS) {
    normalizeString(rawMovie[field], field, movieId);
  }

  return {
    id: normalizeString(rawMovie.id, "id", movieId),
    title: normalizeString(rawMovie.title, "title", movieId),
    description: normalizeString(rawMovie.description, "description", movieId),
    genre: normalizeString(rawMovie.genre, "genre", movieId),
    age: normalizeString(rawMovie.age, "age", movieId),
    duration: normalizeString(rawMovie.duration, "duration", movieId),
    poster: normalizeString(rawMovie.poster, "poster", movieId),
    price: normalizeString(rawMovie.price, "price", movieId),
    sessions: normalizeSessions(rawMovie.sessions, movieId)
  };
}

async function loadSource() {
  const raw = await readFile(sourcePath, "utf8");
  const payload = JSON.parse(raw);

  if (!payload || typeof payload !== "object" || !Array.isArray(payload.movies)) {
    throw new Error('Source file must contain an object with a "movies" array.');
  }

  return {
    movies: payload.movies.map(normalizeMovie)
  };
}

function normalizeHeader(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");
}

function resolveFieldName(headerValue) {
  const normalizedHeader = normalizeHeader(headerValue);

  for (const [fieldName, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalizedHeader)) {
      return fieldName;
    }
  }

  return null;
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((value) => String(value).trim() !== ""));
}

function mapCsvRowsToMovies(rows) {
  if (rows.length < 2) {
    throw new Error("Google Sheets source must contain a header row and at least one movie row.");
  }

  const headerRow = rows[0];
  const fieldNames = headerRow.map(resolveFieldName);

  for (const columnName of REQUIRED_COLUMNS) {
    if (!fieldNames.includes(columnName)) {
      throw new Error(`Google Sheets source is missing required column "${columnName}".`);
    }
  }

  const movies = rows.slice(1).map((row, index) => {
    const rawMovie = {};

    fieldNames.forEach((fieldName, fieldIndex) => {
      if (!fieldName) {
        return;
      }

      rawMovie[fieldName] = String(row[fieldIndex] ?? "").trim();
    });

    if (!Object.values(rawMovie).some(Boolean)) {
      return null;
    }

    return normalizeMovie(rawMovie, index);
  });

  return {
    movies: movies.filter(Boolean)
  };
}

function buildGoogleSheetsUrl() {
  if (googleSheetsCsvUrl) {
    return googleSheetsCsvUrl;
  }

  if (googleSheetsId && googleSheetsGid) {
    return `https://docs.google.com/spreadsheets/d/${googleSheetsId}/export?format=csv&gid=${googleSheetsGid}`;
  }

  if (googleSheetsId && googleSheetsSheetName) {
    return `https://docs.google.com/spreadsheets/d/${googleSheetsId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(googleSheetsSheetName)}`;
  }

  throw new Error(
    'Google Sheets mode requires GOOGLE_SHEETS_CSV_URL or GOOGLE_SHEETS_ID with GOOGLE_SHEETS_GID/GOOGLE_SHEETS_SHEET_NAME.'
  );
}

function fetchText(url, redirectCount = 0) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = get(url, (response) => {
      const { statusCode = 0, headers } = response;

      if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location) {
        response.resume();

        if (redirectCount >= 5) {
          rejectPromise(new Error("Too many redirects while loading Google Sheets source."));
          return;
        }

        const redirectUrl = new URL(headers.location, url).toString();
        resolvePromise(fetchText(redirectUrl, redirectCount + 1));
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        rejectPromise(new Error(`Failed to load Google Sheets source: HTTP ${statusCode}`));
        return;
      }

      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolvePromise(body);
      });
    });

    request.on("error", rejectPromise);
  });
}

function resolveSourceType() {
  if (sourceMode === "local") {
    return "local";
  }

  if (sourceMode === "google-sheets" || sourceMode === "google_sheets" || sourceMode === "sheets") {
    return "google-sheets";
  }

  if (googleSheetsCsvUrl || (googleSheetsId && (googleSheetsGid || googleSheetsSheetName))) {
    return "google-sheets";
  }

  return "local";
}

async function loadGoogleSheetsSource() {
  const csvUrl = buildGoogleSheetsUrl();
  const csvText = await fetchText(csvUrl);
  const rows = parseCsv(csvText);

  return mapCsvRowsToMovies(rows);
}

async function writeOutput(payload) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const sourceType = resolveSourceType();
  const payload = sourceType === "google-sheets"
    ? await loadGoogleSheetsSource()
    : await loadSource();

  await writeOutput(payload);

  if (sourceType === "google-sheets") {
    console.log(`Updated ${outputPath} from Google Sheets`);
    return;
  }

  console.log(`Updated ${outputPath} from ${sourcePath}`);
}

main().catch((error) => {
  console.error("Failed to update movies.json");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
