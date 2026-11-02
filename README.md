# Pokédex

A Gen 1 Pokédex built with plain HTML, CSS and JavaScript. Create a trainer, mark the Pokémon you've caught, and click any Pokémon to see its Pokédex entry from [PokéAPI](https://pokeapi.co).

## Run it

Open `index.html` in your browser. That's it, no installs needed.

## How it works

- **`auth.js`**: trainer profiles. There's no server, so profiles and caught lists are saved in the browser's `localStorage`. Passwords are hashed, never stored as plain text.
- **`index.js`**: loads all 151 Pokémon from PokéAPI in 19 requests (names + one per type), caches them, and builds the grid. Descriptions and stats load only when you open a Pokémon.
- **`styles.css`**: the layout and styling.
# PokeDex
# PokeDex
