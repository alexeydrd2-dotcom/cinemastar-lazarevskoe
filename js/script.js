document.addEventListener("DOMContentLoaded", () => {
  const images = document.querySelectorAll(".js-lightbox-image");

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
});
