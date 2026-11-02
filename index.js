
const pokemonCount = 151; // Gen 1 = 151 Gen 2 = 251 Gen 3 = 386
const API_URL = "https://pokeapi.co/api/v2";
const SPRITE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const ARTWORK_URL = SPRITE_URL + "other/official-artwork/";
const POKEBALL_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";

const TYPES = [
    "normal", "fire", "water", "grass", "electric", "ice", "fighting", "poison", "ground",
    "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"
];

const STAT_NAMES = {
    "hp": "HP", "attack": "Atk", "defense": "Def",
    "special-attack": "SpA", "special-defense": "SpD", "speed": "Spe"
};

let pokedex = [];         // [{ id, name, types }] - pokedex[0] is #001 Bulbasaur
let details = {};         // description, stats... fetched the first time you open a Pokémon
let currentFilter = "all";
let openId = null;        // id of the Pokémon shown in the popup
let cry = null;           // the cry sound that's playing

// Elements that are used alot
const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const dexScreen = document.getElementById("dex-screen");
const grid = document.getElementById("pokemon-grid");
const searchInput = document.getElementById("search");
const typeSelect = document.getElementById("type-filter");
const statusBox = document.getElementById("status");
const statusText = document.getElementById("status-text");
const retryButton = document.getElementById("retry-btn");
const emptyMessage = document.getElementById("empty-message");
const modal = document.getElementById("pokemon-modal");
const cryButton = document.getElementById("modal-cry");

setUpEvents();

if (getCurrentUser()) {
    showDex();
} else {
    showLogin();
}


// Screens

function showLogin() {
    dexScreen.hidden = true;
    loginScreen.hidden = false;
    document.getElementById("login-name").focus();
}

function showDex() {
    const user = getCurrentUser();
    loginScreen.hidden = true;
    dexScreen.hidden = false;
    document.getElementById("trainer-name").textContent = user.name;

    if (pokedex.length) {
        renderGrid(); // already downloaded, just redraw with this trainer's catches
    } else {
        loadPokedexIntoPage();
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const name = document.getElementById("login-name").value;
    const password = document.getElementById("login-password").value;
    // Which button was clicked? Pressing Enter counts as "Log in".
    const action = event.submitter ? event.submitter.value : "login";

    loginError.textContent = "";
    try {
        if (action === "signup") {
            await createTrainer(name, password);
        } else {
            await logIn(name, password);
        }
        loginForm.reset();
        showDex();
    } catch (error) {
        loginError.textContent = error.message;
    }
}


// Getting data from the PokéAPI

async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${url}`);
    }
    return response.json();
}

// "https://pokeapi.co/api/v2/pokemon/25/" -> 25
function idFromUrl(url) {
    return Number(url.split("/").filter(Boolean).pop());
}

async function fetchPokedex() {
    // After the first visit the list is saved in localStorage, so it loads instantly
    const cacheKey = "pokedex-data-" + pokemonCount;
    const cached = readStorage(cacheKey);
    if (cached) return cached;

    // 1 request gets every name...
    const speciesList = await fetchJSON(`${API_URL}/pokemon-species?limit=${pokemonCount}`);
    //and 18 requests (one per type) tell us everyone's types.
    const typeResults = await Promise.all(TYPES.map(type => fetchJSON(`${API_URL}/type/${type}`)));

    const byId = {};
    for (const species of speciesList.results) {
        const id = idFromUrl(species.url);
        byId[id] = { id: id, name: species.name, types: [] };
    }
    for (const type of typeResults) {
        for (const entry of type.pokemon) {
            const pokemon = byId[idFromUrl(entry.pokemon.url)];
            // slot 1 = main type, slot 2 = second type
            if (pokemon) pokemon.types[entry.slot - 1] = type.name;
        }
    }

    const list = Object.values(byId).map(pokemon => ({ ...pokemon, types: pokemon.types.filter(Boolean) }));
    writeStorage(cacheKey, list);
    return list;
}

async function loadPokedexIntoPage() {
    statusBox.hidden = false;
    statusBox.classList.remove("error");
    statusText.textContent = "Loading Pokédex…";
    retryButton.hidden = true;

    try {
        pokedex = await fetchPokedex();
        statusBox.hidden = true;
        renderGrid();
    } catch (error) {
        console.error(error);
        statusBox.classList.add("error");
        statusText.textContent = "Couldn't reach the PokéAPI. Check your internet connection.";
        retryButton.hidden = false;
    }
}

// Extra info for the popup, only fetched when you click a Pokémon
async function fetchDetails(id) {
    if (details[id]) return details[id];

    const [pokemon, species] = await Promise.all([
        fetchJSON(`${API_URL}/pokemon/${id}`),
        fetchJSON(`${API_URL}/pokemon-species/${id}`)
    ]);

    const isEnglish = item => item.language.name === "en";
    const entry = species.flavor_text_entries.find(isEnglish);
    const name = species.names.find(isEnglish);
    const genus = species.genera.find(isEnglish);

    details[id] = {
        name: name ? name.name : displayName(species.name),
        genus: genus ? genus.genus : "",
        description: entry ? cleanText(entry.flavor_text) : "No Pokédex entry yet.",
        source: entry ? "Pokémon " + displayName(entry.version.name) : "",
        height: pokemon.height / 10,   // API gives decimetres -> metres
        weight: pokemon.weight / 10,   // API gives hectograms -> kilograms
        stats: pokemon.stats.map(stat => ({ name: stat.stat.name, value: stat.base_stat })),
        cry: pokemon.cries ? pokemon.cries.latest : null
    };
    return details[id];
}

// The old game text has line breaks and hidden characters in it, tidy them up
function cleanText(text) {
    return text.replace(/\u00ad\n/g, "").replace(/\s+/g, " ").trim();
}


// Small helper

function getPokemon(id) {
    return pokedex[id - 1];
}

function formatNumber(id) {
    return "#" + String(id).padStart(3, "0");
}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}


function displayName(name) {
    const special = { "nidoran-f": "Nidoran ♀", "nidoran-m": "Nidoran ♂", "mr-mime": "Mr. Mime", "farfetchd": "Farfetch'd" };
    return special[name] || name.split("-").map(capitalize).join(" ");
}

function typesHTML(types) {
    return types.map(type => `<span class="type" data-type="${type}">${type}</span>`).join("");
}


// The grid of cards

function renderGrid() {
    const caught = getCaught();
    grid.innerHTML = pokedex.map(pokemon => cardHTML(pokemon, caught.has(pokemon.id))).join("");
    updateProgress();
    applyFilters();
}

function cardHTML(pokemon, isCaught) {
    const name = displayName(pokemon.name);
    return `
        <div class="card ${isCaught ? "caught" : ""}" data-id="${pokemon.id}" data-type="${pokemon.types[0]}">
            <button class="catch-btn" aria-pressed="${isCaught}" aria-label="Caught ${name}" title="Caught?">
                <img src="${POKEBALL_URL}" alt="">
            </button>
            <button class="card-main">
                <span class="card-number">${formatNumber(pokemon.id)}</span>
                <img src="${SPRITE_URL}${pokemon.id}.png" alt="" width="96" height="96" loading="lazy">
                <span class="card-name">${name}</span>
                <span class="types">${typesHTML(pokemon.types)}</span>
            </button>
        </div>`;
}

// One click listener for the whole grid instead of 151 separate ones
function handleGridClick(event) {
    const card = event.target.closest(".card");
    if (!card) return;

    const id = Number(card.dataset.id);
    if (event.target.closest(".catch-btn")) {
        toggleCaught(id);
    } else {
        openPokemon(id);
    }
}

function toggleCaught(id) {
    const isCaught = !getCaught().has(id);
    setCaught(id, isCaught);

    const card = grid.querySelector(`.card[data-id="${id}"]`);
    card.classList.toggle("caught", isCaught);
    card.querySelector(".catch-btn").setAttribute("aria-pressed", isCaught);
    if (isCaught) {
        card.classList.add("just-caught");
        setTimeout(() => card.classList.remove("just-caught"), 600);
    }

    updateProgress();
    applyFilters();
    if (openId === id) updateModalCatchButton();
}

function updateProgress() {
    const count = getCaught().size;
    document.getElementById("caught-count").textContent = `${count} / ${pokemonCount}`;
    document.getElementById("progress-fill").style.width = (count / pokemonCount * 100) + "%";
    document.getElementById("progress-card").classList.toggle("complete", count === pokemonCount);
}

// Hide the cards that don't match the search box, the chips and the type dropdown
function applyFilters() {
    const search = searchInput.value.trim().toLowerCase().replace("#", "");
    const type = typeSelect.value;
    const caught = getCaught();
    let visibleCount = 0;

    for (const card of grid.children) {
        const pokemon = getPokemon(Number(card.dataset.id));
        const isCaught = caught.has(pokemon.id);

        const matchesSearch = !search
            || displayName(pokemon.name).toLowerCase().includes(search)
            || pokemon.id === Number(search);
        const matchesType = !type || pokemon.types.includes(type);
        const matchesFilter = currentFilter === "all"
            || (currentFilter === "caught" && isCaught)
            || (currentFilter === "missing" && !isCaught);

        card.hidden = !(matchesSearch && matchesType && matchesFilter);
        if (!card.hidden) visibleCount++;
    }

    emptyMessage.hidden = visibleCount > 0 || pokedex.length === 0;
}


//  The details popup 

async function openPokemon(id) {
    openId = id;
    const pokemon = getPokemon(id);
    stopCry();

    // Show what we already know straight away...
    modal.dataset.type = pokemon.types[0];
    document.getElementById("modal-img").src = ARTWORK_URL + id + ".png";
    document.getElementById("modal-img").alt = displayName(pokemon.name);
    document.getElementById("modal-number").textContent = formatNumber(id);
    document.getElementById("modal-name").textContent = displayName(pokemon.name);
    document.getElementById("modal-genus").textContent = "";
    document.getElementById("modal-types").innerHTML = typesHTML(pokemon.types);
    document.getElementById("modal-description").textContent = "Loading Pokédex entry…";
    document.getElementById("modal-source").textContent = "";
    document.getElementById("modal-height").textContent = "–";
    document.getElementById("modal-weight").textContent = "–";
    document.getElementById("modal-stats").innerHTML = "";
    cryButton.disabled = true;
    updateModalCatchButton();

    if (!modal.open) modal.showModal();

    //then ask the API for the description and stats
    try {
        const info = await fetchDetails(id);
        if (openId !== id) return;

        document.getElementById("modal-name").textContent = info.name;
        document.getElementById("modal-genus").textContent = info.genus;
        document.getElementById("modal-description").textContent = info.description;
        document.getElementById("modal-source").textContent = info.source;
        document.getElementById("modal-height").textContent = info.height + " m";
        document.getElementById("modal-weight").textContent = info.weight + " kg";
        document.getElementById("modal-stats").innerHTML = info.stats.map(stat => `
            <div class="stat">
                <span class="stat-name">${STAT_NAMES[stat.name]}</span>
                <span class="stat-value">${stat.value}</span>
                <span class="stat-bar"><span style="width: ${Math.min(100, stat.value / 180 * 100)}%"></span></span>
            </div>`).join("");
        cryButton.disabled = !info.cry;
    } catch (error) {
        console.error(error);
        if (openId !== id) return;
        document.getElementById("modal-description").textContent = "Couldn't load this entry. Check your connection and try again.";
    }
}

function updateModalCatchButton() {
    const isCaught = getCaught().has(openId);
    document.getElementById("modal-catch").classList.toggle("caught", isCaught);
    document.getElementById("modal-catch-label").textContent = isCaught ? "Caught!" : "Mark as caught";
}

// Go to the next (1) or previous (-1) Pokémon, wrapping around at the ends
function stepPokemon(direction) {
    const nextId = ((openId - 1 + direction + pokemonCount) % pokemonCount) + 1;
    openPokemon(nextId);
}

function playCry() {
    const info = details[openId];
    if (!info || !info.cry) return;

    stopCry();
    cry = new Audio(info.cry);
    cry.volume = 0.4;
    cry.play().catch(() => {
        cryButton.disabled = true;
        cryButton.title = "Your browser can't play this sound";
    });
}

function stopCry() {
    if (cry) cry.pause();
    cry = null;
}


// Wiring up buttons

function setUpEvents() {
    loginForm.addEventListener("submit", handleLogin);
    document.getElementById("logout-btn").addEventListener("click", () => {
        logOut();
        showLogin();
    });
    retryButton.addEventListener("click", loadPokedexIntoPage);

    // Filters
    typeSelect.innerHTML += TYPES.map(type => `<option value="${type}">${capitalize(type)}</option>`).join("");
    searchInput.addEventListener("input", applyFilters);
    typeSelect.addEventListener("change", applyFilters);
    for (const chip of document.querySelectorAll(".chip")) {
        chip.addEventListener("click", () => {
            document.querySelector(".chip.active").classList.remove("active");
            chip.classList.add("active");
            currentFilter = chip.dataset.filter;
            applyFilters();
        });
    }

    grid.addEventListener("click", handleGridClick);

    // Popup
    document.getElementById("modal-close").addEventListener("click", () => modal.close());
    document.getElementById("modal-prev").addEventListener("click", () => stepPokemon(-1));
    document.getElementById("modal-next").addEventListener("click", () => stepPokemon(1));
    document.getElementById("modal-catch").addEventListener("click", () => toggleCaught(openId));
    cryButton.addEventListener("click", playCry);

    modal.addEventListener("click", event => {
        if (event.target === modal) modal.close(); // clicked the dark area outside the popup
    });
    modal.addEventListener("keydown", event => {
        if (event.key === "ArrowLeft") stepPokemon(-1);
        if (event.key === "ArrowRight") stepPokemon(1);
    });
    modal.addEventListener("close", () => {
        openId = null;
        stopCry();
    });
}
