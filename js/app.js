/* =====================================================
   GROOVE STORE — Renderizado dinámico & Carrito de Compras
   ===================================================== */

const DATA_DIR = "../data";
const params = new URLSearchParams(window.location.search);

/* ===== MANEJO DE STORAGE (CARRITO) ===== */

function getCart() {
  return JSON.parse(localStorage.getItem("groove_cart")) || [];
}

function saveCart(cart) {
  localStorage.setItem("groove_cart", JSON.stringify(cart));
  updateGlobalBadge();
}

function updateGlobalBadge() {
  const cart = getCart();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartBadge = document.querySelector(".cart-badge");
  if (cartBadge) {
    cartBadge.innerText = totalItems;
  }
}

function addToCart(album, band) {
  const cart = getCart();
  const existingIndex = cart.findIndex(
    (item) => item.title === album.title && item.band === band.name,
  );

  if (existingIndex > -1) {
    cart[existingIndex].quantity += 1;
  } else {
    cart.push({
      title: album.title,
      band: band.name,
      price: album.price,
      image: album.image,
      format: album.format,
      quantity: 1,
    });
  }

  saveCart(cart);
  alert(`¡"${album.title}" añadido al carrito!`);
}

/* ===== CARGA DE DATOS Y HELPERS ===== */

async function loadJSON(file) {
  const response = await fetch(`${DATA_DIR}/${file}`);
  if (!response.ok) throw new Error(`HTTP ${response.status} al pedir ${file}`);
  return response.json();
}

function slugify(text) {
  return String(text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getAlbumHref(band, album) {
  const albumSlug = slugify(album.title);
  return `album.html?band=${encodeURIComponent(band.id)}&album=${encodeURIComponent(albumSlug)}`;
}

function getAlbumTracklist(albumDataByBand, band, album) {
  const bandTracks = albumDataByBand?.[band.id];
  const albumKey = slugify(album.title);
  if (bandTracks && Array.isArray(bandTracks[albumKey])) {
    return bandTracks[albumKey];
  }
  return null;
}

function normalizeText(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/* ===== BÚSQUEDA EN TIEMPO REAL ===== */

let searchCatalogCache = null;

async function getSearchCatalog() {
  if (searchCatalogCache) return searchCatalogCache;

  const bandsByGenre = await loadJSON("bands.json");
  const bands = Object.values(bandsByGenre).flat();

  searchCatalogCache = bands.flatMap((band) => [
    {
      type: "band",
      title: band.name,
      subtitle: band.city || "Banda",
      href: `band.html?band=${encodeURIComponent(band.id)}`,
    },
    ...(band.albums || []).map((album) => ({
      type: "album",
      title: album.title,
      subtitle: band.name,
      href: `album.html?band=${encodeURIComponent(band.id)}&album=${encodeURIComponent(slugify(album.title))}`,
    })),
  ]);

  return searchCatalogCache;
}

function createSearchPanel() {
  const panel = document.createElement("div");
  panel.id = "gsearch-panel";
  panel.setAttribute("role", "listbox");
  panel.style.cssText = [
    "display: none",
    "position: fixed",
    "z-index: 2000",
    "top: 0",
    "left: 0",
    "width: min(360px, calc(100vw - 2rem))",
    "max-height: 320px",
    "overflow: auto",
    "background: #fff",
    "border: 1px solid #e0e0e0",
    "border-radius: 12px",
    "box-shadow: 0 16px 40px rgba(0,0,0,0.16)",
    "padding: 0.5rem",
  ].join(";");
  document.body.appendChild(panel);
  return panel;
}

function positionSearchPanel(panel, input) {
  const rect = input.getBoundingClientRect();
  panel.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 220)}px`;
  panel.style.left = `${Math.max(12, rect.left)}px`;
  panel.style.width = `${Math.max(280, rect.width)}px`;
}

function hideSearchPanel(panel) {
  panel.style.display = "none";
  panel.innerHTML = "";
}

async function handleSearchInput(panel, input) {
  const query = input.value.trim();

  if (!query) {
    hideSearchPanel(panel);
    return;
  }

  const catalog = await getSearchCatalog();
  const normalizedQuery = normalizeText(query);
  const results = catalog.filter((item) => {
    const haystack = `${item.title} ${item.subtitle}`;
    return normalizeText(haystack).includes(normalizedQuery);
  });

  if (!results.length) {
    panel.innerHTML = `
      <div style="padding: 0.75rem 0.85rem; color: #666; font-size: 0.95rem;">
        No se encontraron resultados para “${query}”.
      </div>`;
    positionSearchPanel(panel, input);
    panel.style.display = "block";
    return;
  }

  const markup = results
    .slice(0, 8)
    .map(
      (item) => `
        <a href="${item.href}" style="display:block; text-decoration:none; color:inherit; padding:0.75rem 0.85rem; border-radius:10px; margin-bottom:0.35rem; background:#fafafa;" data-search-result>
          <div style="font-size:0.92rem; font-weight:700; text-transform:uppercase; color:#111;">${item.title}</div>
          <div style="font-size:0.8rem; color:#777; margin-top:0.2rem;">${item.type === "band" ? "BANDA" : "ÁLBUM"} · ${item.subtitle}</div>
        </a>`,
    )
    .join("");

  panel.innerHTML = markup;
  positionSearchPanel(panel, input);
  panel.style.display = "block";
}

function attachSearchBehavior() {
  const searchInputs = Array.from(
    document.querySelectorAll(".search-bar input"),
  );
  if (!searchInputs.length) return;

  const panel = createSearchPanel();
  const closePanel = () => hideSearchPanel(panel);

  searchInputs.forEach((input) => {
    input.addEventListener("input", () => handleSearchInput(panel, input));
    input.addEventListener("focus", () => {
      if (input.value.trim()) handleSearchInput(panel, input);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePanel();
    });
  });

  document.addEventListener("click", (event) => {
    const clickedInsideSearch = searchInputs.some((input) =>
      input.contains(event.target),
    );
    const clickedInsideResults = panel.contains(event.target);
    if (!clickedInsideSearch && !clickedInsideResults) closePanel();
  });
}

/* ===== TEMPLATES ===== */

const novedadesCard = (band, album) => `
  <article class="card-item">
    <span class="card-sticker">NUEVO</span>
    <a href="${getAlbumHref(band, album)}" style="text-decoration: none; color: inherit;">
      <div class="card-img-placeholder">
        <img src="${album.image}" alt="${album.alt || album.title}" />
      </div>
      <span class="card-artist">${band.name}</span>
      <h3 class="card-title">${album.title}</h3>
      <p class="card-details">${album.year} • ${album.format}</p>
    </a>
    <div class="card-footer">
      <span class="card-price">$${album.price.toFixed(2)}</span>
      <button class="btn-add">AÑADIR</button>
    </div>
  </article>
`;

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
  <a href="band.html?band=${band.id}" class="card-polaroid ${index % 2 === 0 ? "tilt-left" : "tilt-right"}" style="text-decoration: none; color: inherit; display: block">
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

const albumCard = (band, album, index) => {
  const card = `
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

  return `<a href="${getAlbumHref(band, album)}" style="text-decoration: none; color: inherit; display: block">${card}</a>`;
};

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

const albumDetail = (band, album, tracklist = null) => {
  const songs =
    Array.isArray(tracklist) && tracklist.length > 0
      ? tracklist
      : [
          `${album.title} - Track 1`,
          `${album.title} - Track 2`,
          `${album.title} - Track 3`,
          `${album.title} - Track 4`,
        ];

  const half = Math.ceil(songs.length / 2);
  const sideA = songs.slice(0, half);
  const sideB = songs.slice(half);

  const renderTrackColumn = (tracks, sideLabel) =>
    `<div class="track-col">${tracks
      .map((track, index) => {
        const number = `${sideLabel}${index + 1}`;
        const title = typeof track === "string" ? track : track.title;
        const duration =
          typeof track === "string" ? "--:--" : (track.duration ?? "--:--");
        return `
          <div class="track-item">
            <span class="track-number">${number}</span>
            <span class="track-name">${title}</span>
            <span class="track-duration">${duration}</span>
          </div>`;
      })
      .join("")}</div>`;

  return `
    <main class="product-main">
      <div class="product-container">
        <div class="product-gallery">
          <div class="main-image-wrapper">
            <img src="${album.image}" alt="${album.alt}" class="main-image" />
            <div class="pressing-badge">${album.format}</div>
          </div>
        </div>

        <div class="product-details">
          <div class="artist-name">${band.name}</div>
          <h1 class="album-title">${album.title}</h1>

          <div class="tags-row">
            <span class="tag-box">${album.year}</span>
            <span class="tag-box">${album.format}</span>
            <span class="tag-box">VINILO</span>
          </div>

          <div class="price-row">
            <span class="price-amount">$${album.price.toFixed(2)}</span>
            <span class="availability-text">DISPONIBLE — ENVÍO EN 24H</span>
          </div>

          <div class="actions-row">
            <button class="add-to-cart-btn">AÑADIR AL CARRITO</button>
            <button class="wishlist-btn" aria-label="Añadir a favoritos">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="#000" stroke-width="2" fill="none" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>

          <div class="tracklist-section">
            <h2 class="tracklist-title">TRACKLIST – SIDE A / SIDE B</h2>
            <div class="tracklist-grid">
              ${renderTrackColumn(sideA, "A")}
              ${renderTrackColumn(sideB, "B")}
            </div>
          </div>
        </div>
      </div>
    </main>`;
};

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
  if (albumsEl)
    albumsEl.innerHTML = band.albums
      .map((album, index) => albumCard(band, album, index))
      .join("");
}

async function renderAlbumPage(detailEl) {
  const [bandsByGenre, albumTracks] = await Promise.all([
    loadJSON("bands.json"),
    loadJSON("album-tracks.json"),
  ]);

  const band = Object.values(bandsByGenre)
    .flat()
    .find((b) => b.id === params.get("band"));

  if (!band) {
    detailEl.innerHTML = notFound("Álbum no encontrado.");
    return;
  }

  const requestedAlbum = params.get("album") || "";
  const album = band.albums.find(
    (item) =>
      slugify(item.title) === slugify(requestedAlbum) ||
      item.title.toUpperCase() === requestedAlbum.toUpperCase(),
  );

  if (!album) {
    detailEl.innerHTML = notFound("Álbum no encontrado.");
    return;
  }

  const tracklist = getAlbumTracklist(albumTracks, band, album);

  document.title = `GROOVESTORE - ${band.name} - ${album.title}`;
  if (detailEl) {
    detailEl.innerHTML = albumDetail(band, album, tracklist);

    const addBtn = detailEl.querySelector(".add-to-cart-btn");
    if (addBtn) {
      addBtn.addEventListener("click", () => addToCart(album, band));
    }
  }
}

// === NOVEDADES PAGE (Adaptado a tus tarjetas estáticas) ===
async function renderNovedadesPage(gridEl) {
  // 1. Array con los datos exactos de las tres tarjetas que dejaste en el HTML
  const hardcodedAlbums = [
    {
      band: { name: "DAFT PUNK" },
      album: {
        title: "RANDOM ACCESS MEMORIES",
        price: 45.0,
        image:
          "https://i.scdn.co/image/ab67616d0000b2739b9b36b0e22870b9f542d937",
        format: "2LP 10° Aniversario",
      },
    },
    {
      band: { name: "ARCTIC MONKEYS" },
      album: {
        title: "AM (SPECIAL PRESS)",
        price: 32.0,
        image:
          "https://upload.wikimedia.org/wikipedia/en/0/04/Arctic_Monkeys_-_AM.png",
        format: "Vinilo Rojo Transparente",
      },
    },
    {
      band: { name: "EL CUARTETO DE NOS" },
      album: {
        title: "RARO",
        price: 29.0,
        image:
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTOcXc37dQLY0X4xpxVVm67ErHt9ixYHBuQpHIT-jwdw&s=10",
        format: "Edición Deluxe • Vinilo Blanco",
      },
    },
  ];

  // 2. Conectamos los botones de tu grilla a la función addToCart
  const addButtons = gridEl.querySelectorAll(".btn-add");
  addButtons.forEach((btn, index) => {
    if (hardcodedAlbums[index]) {
      btn.addEventListener("click", () => {
        addToCart(hardcodedAlbums[index].album, hardcodedAlbums[index].band);
      });
    }
  });

  // 3. También conectamos el disco destacado de The Strokes ("Hero")
  const heroBtn = document.querySelector(".btn-buy-hero");
  if (heroBtn) {
    heroBtn.addEventListener("click", () => {
      addToCart(
        {
          title: "THE NEW ABNORMAL",
          price: 38.0,
          image:
            "https://i.scdn.co/image/ab67616d0000b273e3f1ba3de4659708c25d0f39",
          format: "180G VINYL",
        },
        { name: "THE STROKES" },
      );
    });
  }
}

/* ===== INIT ===== */

function renderError(containers) {
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
  const albumDetailEl = document.querySelector("[data-album-detail]");
  // Ahora apuntamos directo a tu clase en HTML, sin necesitar data-attributes
  const novedadesGridEl = document.querySelector(".releases-grid");

  const containers = [
    genresGrid,
    genreHeroEl,
    genreBandsEl,
    bandBioEl,
    bandAlbumsEl,
    albumDetailEl,
    novedadesGridEl,
  ].filter(Boolean);

  if (containers.length === 0) return;

  try {
    if (genresGrid) await renderHome(genresGrid);
    if (genreHeroEl || genreBandsEl)
      await renderGenrePage(genreHeroEl, genreBandsEl);
    if (bandBioEl || bandAlbumsEl)
      await renderBandPage(bandBioEl, bandAlbumsEl);
    if (albumDetailEl) await renderAlbumPage(albumDetailEl);
    if (novedadesGridEl) await renderNovedadesPage(novedadesGridEl);
    attachSearchBehavior();
  } catch (error) {
    console.error("GROOVE STORE: no se pudieron cargar los datos", error);
    renderError(containers);
  }
}

/* ===== LÓGICA VISTA DE LA CAJA / CARRITO (caja.html) ===== */

document.addEventListener("DOMContentLoaded", () => {
  updateGlobalBadge();

  const itemsList = document.querySelector(".items-list");

  function renderCartItems() {
    if (!itemsList) return;

    const cart = getCart();

    if (cart.length === 0) {
      itemsList.innerHTML =
        '<p style="text-align: center; font-weight: bold; padding: 40px 0;">Tu caja está vacía. ¡Ve a buscar algo de música!</p>';
      updateTotals();
      return;
    }

    itemsList.innerHTML = cart
      .map(
        (item, index) => `
        <div class="cart-item" data-index="${index}">
          <img src="${item.image}" alt="${item.title}" style="width: 60px; height: 60px; object-fit: cover;" />
          <div class="item-details">
            <h4>${item.title}</h4>
            <p>${item.band} · ${item.format}</p>
            <span class="item-price">$${item.price.toFixed(2)}</span>
          </div>
          <div class="quantity-control">
            <button class="btn-qty-minus">-</button>
            <input type="number" value="${item.quantity}" readonly />
            <button class="btn-qty-plus">+</button>
          </div>
          <button class="remove-btn">✕</button>
        </div>`,
      )
      .join("");

    updateTotals();
  }

  function updateTotals() {
    const cart = getCart();
    let subtotal = 0;
    let totalItems = 0;

    cart.forEach((item) => {
      subtotal += item.price * item.quantity;
      totalItems += item.quantity;
    });

    // LÓGICA DE ENVÍO: Gratis si pasa de $100
    let shippingCost = 0;
    let shippingText = "GRATIS ⚡";
    let isFreeShipping = true;

    if (subtotal < 100 && totalItems > 0) {
      shippingCost = 15.0;
      shippingText = `$${shippingCost.toFixed(2)}`;
      isFreeShipping = false;
    } else if (totalItems === 0) {
      shippingText = "$0.00";
      isFreeShipping = false;
    }

    const tax = subtotal * 0.08;
    const total = subtotal + tax + shippingCost;

    // ACTUALIZAR TEXTOS
    const itemCountEl = document.querySelector(".item-count");
    const totalPriceEl = document.querySelector(".total-price");
    const btnCheckout = document.querySelector(".btn-checkout");

    // IDs de resumen (agregados previamente en caja.html)
    const resumenCantidad = document.getElementById("resumen-cantidad");
    const resumenSubtotal = document.getElementById("resumen-subtotal");
    const resumenEnvio = document.getElementById("resumen-envio");
    const resumenTax = document.getElementById("resumen-tax");
    const resumenTotal = document.getElementById("resumen-total");

    if (itemCountEl) itemCountEl.innerHTML = `— ${totalItems} DISCOS`;
    if (totalPriceEl) totalPriceEl.innerText = `$${total.toFixed(2)}`;

    // Actualizar el ticket lateral si existen los IDs
    if (resumenCantidad) resumenCantidad.innerText = `Subtotal (${totalItems})`;
    if (resumenSubtotal) resumenSubtotal.innerText = `$${subtotal.toFixed(2)}`;
    if (resumenTax) resumenTax.innerText = `$${tax.toFixed(2)}`;
    if (resumenTotal) resumenTotal.innerText = `$${total.toFixed(2)}`;

    // Estilos del envío
    if (resumenEnvio) {
      resumenEnvio.innerText = shippingText;
      if (isFreeShipping && totalItems > 0) {
        resumenEnvio.style.color = "#e23b1e";
        resumenEnvio.style.fontWeight = "bold";
      } else {
        resumenEnvio.style.color = "inherit";
        resumenEnvio.style.fontWeight = "normal";
      }
    }

    // Botón checkout
    if (btnCheckout) {
      btnCheckout.style.opacity = totalItems === 0 ? "0.5" : "1";
      btnCheckout.style.pointerEvents = totalItems === 0 ? "none" : "auto";
    }

    updateGlobalBadge();
  }

  if (itemsList) {
    itemsList.addEventListener("click", (e) => {
      const cart = getCart();
      const itemEl = e.target.closest(".cart-item");
      if (!itemEl) return;

      const index = parseInt(itemEl.dataset.index);

      if (e.target.classList.contains("remove-btn")) {
        cart.splice(index, 1);
        saveCart(cart);
        renderCartItems();
      }

      if (e.target.classList.contains("btn-qty-plus")) {
        cart[index].quantity += 1;
        saveCart(cart);
        renderCartItems();
      }

      if (
        e.target.classList.contains("btn-qty-minus") &&
        cart[index].quantity > 1
      ) {
        cart[index].quantity -= 1;
        saveCart(cart);
        renderCartItems();
      }
    });

    renderCartItems();
  }
});

init();
<<<<<<< HEAD

document.addEventListener("DOMContentLoaded", () => {
  updateGlobalBadge();

  const itemsList = document.querySelector(".items-list");
  const orderItemsContainer = document.querySelector(".order-items");
  const subtotalEl = document.querySelector(".order-subtotal span:last-child");
  const totalAmountEl = document.querySelector(".total-amount");
  const checkoutForm = document.querySelector(".checkout-grid");
  const btnCheckout = document.querySelector(".btn-checkout");

  function renderCartItems() {
    if (!itemsList) return;

    const cart = getCart();

    if (cart.length === 0) {
      itemsList.innerHTML =
        '<p style="text-align: center; font-weight: bold; padding: 40px 0;">Tu caja está vacía. ¡Ve a buscar algo de música!</p>';
      updateTotals();
      return;
    }

    itemsList.innerHTML = cart
      .map(
        (item, index) => `
        <div class="cart-item" data-index="${index}">
          <img src="${item.image}" alt="${item.title}" style="width: 60px; height: 60px; object-fit: cover;" />
          <div class="item-details">
            <h4>${item.title}</h4>
            <p>${item.band} · ${item.format}</p>
            <span class="item-price">$${item.price.toFixed(2)}</span>
          </div>
          <div class="quantity-control">
            <button class="btn-qty-minus">-</button>
            <input type="number" value="${item.quantity}" readonly />
            <button class="btn-qty-plus">+</button>
          </div>
          <button class="remove-btn">✕</button>
        </div>`,
      )
      .join("");

    updateTotals();
  }

  function updateTotals() {
    const cart = getCart();
    let subtotal = 0;
    let totalItems = 0;

    cart.forEach((item) => {
      subtotal += item.price * item.quantity;
      totalItems += item.quantity;
    });

    let shippingCost = 0;
    let shippingText = "GRATIS ⚡";
    let isFreeShipping = true;

    if (subtotal < 100 && totalItems > 0) {
      shippingCost = 15.0;
      shippingText = `$${shippingCost.toFixed(2)}`;
      isFreeShipping = false;
    } else if (totalItems === 0) {
      shippingText = "$0.00";
      isFreeShipping = false;
    }

    const tax = subtotal * 0.08;
    const total = subtotal + tax + shippingCost;

    const itemCountEl = document.querySelector(".item-count");
    const totalPriceEl = document.querySelector(".total-price");
    const resumenCantidad = document.getElementById("resumen-cantidad");
    const resumenSubtotal = document.getElementById("resumen-subtotal");
    const resumenEnvio = document.getElementById("resumen-envio");
    const resumenTax = document.getElementById("resumen-tax");
    const resumenTotal = document.getElementById("resumen-total");

    if (itemCountEl) itemCountEl.innerHTML = `— ${totalItems} DISCOS`;
    if (totalPriceEl) totalPriceEl.innerText = `$${total.toFixed(2)}`;

    if (resumenCantidad) resumenCantidad.innerText = `Subtotal (${totalItems})`;
    if (resumenSubtotal) resumenSubtotal.innerText = `$${subtotal.toFixed(2)}`;
    if (resumenTax) resumenTax.innerText = `$${tax.toFixed(2)}`;
    if (resumenTotal) resumenTotal.innerText = `$${total.toFixed(2)}`;

    if (resumenEnvio) {
      resumenEnvio.innerText = shippingText;
      if (isFreeShipping && totalItems > 0) {
        resumenEnvio.style.color = "#e23b1e";
        resumenEnvio.style.fontWeight = "bold";
      } else {
        resumenEnvio.style.color = "inherit";
        resumenEnvio.style.fontWeight = "normal";
      }
    }

    if (btnCheckout) {
      btnCheckout.style.opacity = totalItems === 0 ? "0.5" : "1";
      btnCheckout.style.pointerEvents = totalItems === 0 ? "none" : "auto";
    }

    updateGlobalBadge();
  }

  function renderCheckoutSummary() {
    if (!orderItemsContainer) return;

    const cart = getCart();

    if (cart.length === 0) {
      orderItemsContainer.innerHTML = `
        <div class="order-item" style="color: #a1a1aa; font-style: italic;">
          <span>No hay discos en el carrito</span>
          <span>$0.00</span>
        </div>`;
      if (subtotalEl) subtotalEl.innerText = "$0.00";
      if (totalAmountEl) totalAmountEl.innerText = "$0.00";
      return;
    }

    orderItemsContainer.innerHTML = cart
      .map(
        (item) => `
        <div class="order-item">
          <span class="item-name">${item.title} (${item.quantity})</span>
          <span class="item-price">$${(item.price * item.quantity).toFixed(2)}</span>
        </div>`
      )
      .join("");

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    if (subtotalEl) subtotalEl.innerText = `$${subtotal.toFixed(2)}`;
    if (totalAmountEl) totalAmountEl.innerText = `$${total.toFixed(2)}`;
  }

  if (itemsList) {
    itemsList.addEventListener("click", (e) => {
      const cart = getCart();
      const itemEl = e.target.closest(".cart-item");
      if (!itemEl) return;

      const index = parseInt(itemEl.dataset.index);

      if (e.target.classList.contains("remove-btn")) {
        cart.splice(index, 1);
        saveCart(cart);
        renderCartItems();
      }

      if (e.target.classList.contains("btn-qty-plus")) {
        cart[index].quantity += 1;
        saveCart(cart);
        renderCartItems();
      }

      if (
        e.target.classList.contains("btn-qty-minus") &&
        cart[index].quantity > 1
      ) {
        cart[index].quantity -= 1;
        saveCart(cart);
        renderCartItems();
      }
    });

    renderCartItems();
  }

  renderCheckoutSummary();

  if (btnCheckout) {
    btnCheckout.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "venta.html";
    });
  }

  if (checkoutForm) {
    checkoutForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const cart = getCart();
      if (cart.length === 0) {
        alert("Tu carrito está vacío.");
        return;
      }

      localStorage.removeItem("groove_cart");
      window.location.href = "compra-realizada.html";
    });
  }
});
=======
document.addEventListener("DOMContentLoaded", () => {
  const btnCheckout = document.querySelector(".btn-checkout");

  if (btnCheckout) {
    btnCheckout.addEventListener("click", (e) => {
      e.preventDefault();

      // 1. Vaciar el carrito en el almacenamiento local
      localStorage.removeItem("groove_cart");

      // 2. Redirigir a la página de confirmación de compra
      window.location.href = "compra-realizada.html";
    });
  }
});
>>>>>>> b2955d82cdcedcecb817f89bd65a244b30e91f7e
