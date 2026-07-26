/* =====================================================
   GROOVE STORE — Renderizado dinámico con template literals
   Datos: ../data/genres.json y ../data/bands.json.
   Cada página marca sus contenedores con un atributo data-*
   y este script rellena los que encuentre:
     [data-genres-grid]   index.html  → tarjetas de todos los géneros
     [data-genre-hero]    genre.html  → hero del género de ?genre=<id>
     [data-genre-bands]   genre.html  → tarjetas de bandas de ?genre=<id>
     [data-band-bio]      band.html   → biografía de la banda de ?band=<id>
     [data-band-albums]   band.html   → álbumes de la banda de ?band=<id>
   ===================================================== */

const DATA_DIR = "../data";

const params = new URLSearchParams(window.location.search);

async function loadJSON(file) {
  const response = await fetch(`${DATA_DIR}/${file}`);
  if (!response.ok) throw new Error(`HTTP ${response.status} al pedir ${file}`);
  return response.json();
}

/* ===== TEMPLATES ===== */

const genreCard = (genre) => `
  <a href="genre.html?genre=${genre.id}" style="text-decoration: none; color: inherit">
    <article class="card">
      <div class="card-image-wrapper">
        <img src="${genre.image}" alt="${genre.alt}" />
      </div>
      <div class="card-content">
        <h3 class="card-title">${genre.title}</h3>
        <p class="card-leader">
          ${genre.leaderType} líder: <span class="leader-name">${genre.leader}</span>
        </p>
      </div>
    </article>
  </a>`;

const genreHero = (genre) => `
  <div class="hero-banner">
    <div class="hero-text-box">
      <span class="genre-badge">GENRE BOSS </span>
      <h1 class="hero-title">${genre.heroTitle}</h1>
      <p class="hero-desc">${genre.description}</p>
    </div>
    <div class="hero-image-box">
      <img src="${genre.heroImage}" alt="${genre.heroAlt}" />
    </div>
  </div>`;

const bandCard = (band, index) => `
  <a
    href="band.html?band=${band.id}"
    class="card-polaroid ${index % 2 === 0 ? "tilt-left" : "tilt-right"}"
    style="text-decoration: none; color: inherit; display: block"
  >
    <div class="card-image-wrapper">
      <img src="${band.image}" alt="${band.alt}" />
    </div>
    <div class="card-content">
      <h3 class="artist-name">${band.name}</h3>
      <div class="artist-info">
        <span>${band.city}${band.records ? ` &middot; ${band.records} RECORDS` : ""}</span>
        ${band.boss ? `<span class="boss-tag">BOSS &#9733;</span>` : ""}
      </div>
    </div>
  </a>`;

const albumCard = (album, index) => `
  <article class="album-card ${album.featured ? "active-card " : ""}${index % 2 === 0 ? "tilt-right" : "tilt-left"}">
    <div class="album-image-wrapper">
      <img src="${album.image}" alt="${album.alt}" />
    </div>
    <div class="album-info">
      <h3 class="album-title">${album.title}</h3>
      <span class="album-meta">${album.year} &middot; ${album.format}</span>
      <p class="album-price">$${album.price.toFixed(2)}</p>
    </div>
  </article>`;

const bandBio = (band) => `
  <div class="bio-grid">
    <div class="bio-image-col">
      <div class="polaroid-frame tilt-left">
        <div class="polaroid-img-wrapper">
          <img src="${band.bio.image}" alt="${band.bio.alt}" />
        </div>
      </div>
    </div>

    <div class="bio-text-col">
      <h1 class="artist-title">${band.name}</h1>

      <div class="artist-badges">
        ${band.bio.badges.map((badge) => `<span class="badge-item">${badge}</span>`).join("")}
      </div>

      <h2 class="history-heading">HISTORIA</h2>

      <div class="history-body">
        ${band.bio.history.map((parrafo) => `<p>${parrafo}</p>`).join("")}
      </div>
    </div>
  </div>`;

const notFound = (mensaje) => `
  <p style="padding: 2rem 0; font-weight: 600">
    ${mensaje} <a href="index.html">Volver al inicio</a>.
  </p>`;

/* ===== RENDER POR PÁGINA ===== */

async function renderHome(grid) {
  const genres = await loadJSON("genres.json");
  grid.innerHTML = genres.map(genreCard).join("");
}

async function renderGenrePage(heroEl, bandsEl) {
  /* bands.json agrupa las bandas por género: { "grunge": [...], "pop-punk": [...] } */
  const [genres, bandsByGenre] = await Promise.all([
    loadJSON("genres.json"),
    loadJSON("bands.json"),
  ]);

  const genre = genres.find((g) => g.id === params.get("genre"));
  if (!genre) {
    (heroEl ?? bandsEl).innerHTML = notFound("Género no encontrado.");
    return;
  }

  document.title = `GROOVESTORE - ${genre.heroTitle}`;
  if (heroEl) heroEl.innerHTML = genreHero(genre);
  if (bandsEl) {
    const bands = bandsByGenre[genre.id] ?? [];
    bandsEl.innerHTML = bands.map(bandCard).join("");
  }
}

async function renderBandPage(bioEl, albumsEl) {
  const bandsByGenre = await loadJSON("bands.json");

  const band = Object.values(bandsByGenre)
    .flat()
    .find((b) => b.id === params.get("band"));
  if (!band) {
    (bioEl ?? albumsEl).innerHTML = notFound("Banda no encontrada.");
    return;
  }

  document.title = `GROOVESTORE - ${band.name}`;
  if (bioEl) bioEl.innerHTML = bandBio(band);
  if (albumsEl) albumsEl.innerHTML = band.albums.map(albumCard).join("");
}

/* ===== INIT ===== */

function renderError(containers) {
  /* fetch() no funciona con el protocolo file://, hay que servir el sitio por HTTP */
  const hint =
    window.location.protocol === "file:"
      ? "Sirve el sitio con «python3 -m http.server 8000» y abre http://localhost:8000/html/"
      : "Revisa que los archivos de data/ existan y sean JSON válido.";
  containers.forEach((container) => {
    container.innerHTML = `<p style="padding: 2rem 0; font-weight: 600">No se pudieron cargar los datos de la tienda. ${hint}</p>`;
  });
}

async function init() {
  const genresGrid = document.querySelector("[data-genres-grid]");
  const genreHeroEl = document.querySelector("[data-genre-hero]");
  const genreBandsEl = document.querySelector("[data-genre-bands]");
  const bandBioEl = document.querySelector("[data-band-bio]");
  const bandAlbumsEl = document.querySelector("[data-band-albums]");

  const containers = [
    genresGrid,
    genreHeroEl,
    genreBandsEl,
    bandBioEl,
    bandAlbumsEl,
  ].filter(Boolean);
  if (containers.length === 0) return;

  try {
    if (genresGrid) await renderHome(genresGrid);
    if (genreHeroEl || genreBandsEl)
      await renderGenrePage(genreHeroEl, genreBandsEl);
    if (bandBioEl || bandAlbumsEl)
      await renderBandPage(bandBioEl, bandAlbumsEl);
  } catch (error) {
    console.error("GROOVE STORE: no se pudieron cargar los datos", error);
    renderError(containers);
  }
}

init();
