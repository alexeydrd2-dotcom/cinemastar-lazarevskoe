document.addEventListener("DOMContentLoaded", () => {
  const images = document.querySelectorAll(".js-lightbox-image");
  const moviesGrid = document.querySelector("[data-movies-grid]");
  const scheduleTable = document.querySelector("[data-schedule-table]");

  if (images.length) {
    const lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.setAttribute("aria-hidden", "true");

    const dialog = document.createElement("div");
    dialog.className = "lightbox__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const fullImage = document.createElement("img");
    fullImage.className = "lightbox__image";
    fullImage.alt = "";

    const closeButton = document.createElement("button");
    closeButton.className = "lightbox__close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close image");
    closeButton.textContent = "x";

    dialog.append(closeButton, fullImage);
    lightbox.append(dialog);
    document.body.append(lightbox);

    let lastActiveElement = null;

    function openLightbox(image) {
      lastActiveElement = document.activeElement;
      fullImage.src = image.currentSrc || image.src;
      fullImage.alt = image.alt || "";
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      closeButton.focus();
    }

    function closeLightbox() {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      fullImage.removeAttribute("src");
      fullImage.alt = "";
      document.body.style.overflow = "";

      if (lastActiveElement instanceof HTMLElement) {
        lastActiveElement.focus();
      }
    }

    images.forEach((image) => {
      image.addEventListener("click", () => openLightbox(image));
    });

    closeButton.addEventListener("click", closeLightbox);

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && lightbox.classList.contains("is-open")) {
        closeLightbox();
      }
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderMovies(movies) {
    if (!moviesGrid) {
      return;
    }

    moviesGrid.innerHTML = movies
      .map((movie) => {
        const title = escapeHtml(movie.title);
        const description = escapeHtml(movie.description || "Описание скоро появится.");
        const genre = escapeHtml(movie.genre);
        const meta = escapeHtml(`${movie.age} • ${movie.duration}`);
        const poster = escapeHtml(movie.poster);

        return `
          <article class="movie-card">
            <div class="movie-card__inner">
              <div class="movie-card__face movie-card__face--front">
                <div class="movie-card__poster">
                  <img class="movie-card__image" src="${poster}" alt="Постер фильма ${title}">
                </div>
                <div class="movie-card__content">
                  <h3>${title}</h3>
                  <p>${genre}</p>
                  <p>${meta}</p>
                  <a href="#schedule" class="movie-card__link">Сеансы</a>
                </div>
              </div>
              <div class="movie-card__face movie-card__face--back">
                <div class="movie-card__back-content">
                  <h3>${title}</h3>
                  <p class="movie-card__description">${description}</p>
                  <p class="movie-card__back-meta">${meta}</p>
                  <a href="#schedule" class="movie-card__link">Сеансы</a>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderSchedule(movies) {
    if (!scheduleTable) {
      return;
    }

    const rows = movies
      .map((movie) => {
        const sessions = Array.isArray(movie.sessions) && movie.sessions.length
          ? movie.sessions.map((session) => escapeHtml(session)).join(" / ")
          : "Уточняется";

        return `
          <tr>
            <td>${escapeHtml(movie.title)}</td>
            <td>${sessions}</td>
            <td>${escapeHtml(movie.age)}</td>
            <td>${escapeHtml(movie.price)}</td>
          </tr>
        `;
      })
      .join("");

    scheduleTable.innerHTML = `
      <tr>
        <th>Фильм</th>
        <th>Время</th>
        <th>Возраст</th>
        <th>Цена</th>
      </tr>
      ${rows}
    `;
  }

  async function loadMovies() {
    if (!moviesGrid || !scheduleTable) {
      return;
    }

    try {
      const response = await fetch("data/movies.json");

      if (!response.ok) {
        throw new Error(`Failed to load movies.json: ${response.status}`);
      }

      const payload = await response.json();

      if (!payload || !Array.isArray(payload.movies) || !payload.movies.length) {
        throw new Error("movies.json has invalid structure");
      }

      renderMovies(payload.movies);
      renderSchedule(payload.movies);
    } catch (error) {
      console.error("Не удалось загрузить афишу из JSON. Оставлен fallback из HTML.", error);
    }
  }

  function closeFlippedMovieCards(exceptCard = null) {
    if (!moviesGrid) {
      return;
    }

    moviesGrid.querySelectorAll(".movie-card.is-flipped").forEach((card) => {
      if (card !== exceptCard) {
        card.classList.remove("is-flipped");
      }
    });
  }

  if (moviesGrid) {
    moviesGrid.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (event.target.closest(".movie-card__link")) {
        return;
      }

      const card = event.target.closest(".movie-card");

      if (!card || !card.querySelector(".movie-card__face--back")) {
        return;
      }

      const isFlipped = card.classList.contains("is-flipped");
      closeFlippedMovieCards(card);
      card.classList.toggle("is-flipped", !isFlipped);
    });
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (!event.target.closest(".movie-card")) {
      closeFlippedMovieCards();
    }
  });

  loadMovies();
});
