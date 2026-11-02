//  Trainer profiles
//  There's no server, so every profile is saved in the browser's
//  localStorage. That means profiles only exist on this computer,
//  in this browser.
//
//  What gets saved under "pokedex-users":
//  {
//      "ash": { name: "Ash", passwordHash: "9f2c...", caught: [1, 4, 25] }
//  }

const USERS_KEY = "pokedex-users";
const SESSION_KEY = "pokedex-current-user";

// localStorage can only hold strings, so we convert to/from JSON
function readStorage(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return null;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn("Couldn't save to localStorage", error);
    }
}

function getUsers() {
    return readStorage(USERS_KEY) || {};
}

// Never store the real password, store a "hash" of it instead.
// A hash is a one-way scramble: the same password always gives the
// same hash, but you can't turn the hash back into the password.
async function hashPassword(key, password) {
    const text = key + ":" + password;

    // crypto.subtle only exists on "secure" pages (https, localhost, and usually
    // files you double-click). If it's missing, use a simple homemade hash instead.
    if (!window.crypto || !crypto.subtle) {
        let hash = 0;
        for (const char of text) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
        return "simple-" + hash.toString(16);
    }

    const bytes = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

// Trainer names aren't case sensitive: "Ash" and "ash" are the same trainer
function toKey(name) {
    return name.trim().toLowerCase();
}

async function createTrainer(name, password) {
    name = name.trim();
    const key = toKey(name);
    const users = getUsers();

    if (name.length < 2) throw new Error("Trainer name needs at least 2 characters.");
    if (password.length < 4) throw new Error("Password needs at least 4 characters.");
    if (users[key]) throw new Error("That trainer already exists. Try logging in.");

    users[key] = { name: name, passwordHash: await hashPassword(key, password), caught: [] };
    writeStorage(USERS_KEY, users);
    writeStorage(SESSION_KEY, key);
}

async function logIn(name, password) {
    const key = toKey(name);
    const user = getUsers()[key];

    if (!user || user.passwordHash !== await hashPassword(key, password)) {
        throw new Error("Wrong trainer name or password.");
    }
    writeStorage(SESSION_KEY, key);
}

function logOut() {
    localStorage.removeItem(SESSION_KEY);
}

function getCurrentUser() {
    const key = readStorage(SESSION_KEY);
    return key ? getUsers()[key] : null;
}

// Returns a Set of caught Pokémon ids, e.g. Set {1, 4, 25}
function getCaught() {
    const user = getCurrentUser();
    return new Set(user ? user.caught : []);
}

function setCaught(id, isCaught) {
    const key = readStorage(SESSION_KEY);
    const users = getUsers();
    const caught = new Set(users[key].caught);

    if (isCaught) {
        caught.add(id);
    } else {
        caught.delete(id);
    }

    users[key].caught = Array.from(caught).sort((a, b) => a - b);
    writeStorage(USERS_KEY, users);
}
