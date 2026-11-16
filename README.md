# Tower of Hanoi — Logic Programming Project

**Developer:** Jennely E. Parado  
**Section:** BSIT 3-A

A browser-based Tower of Hanoi puzzle with a dark wooden game board and a Tech Green + Pink interface. The game logic and HTTP server are powered by SWI-Prolog; the frontend uses plain HTML, CSS, and JavaScript.

## Features

- SWI-Prolog HTTP server on port `8080`
- Three-peg Tower of Hanoi puzzle
- 3–8 disks
- Prolog validation for every player move (`POST /api/move`)
- Prolog-generated optimal solution for three pegs (`POST /api/solve`)
- Timer, move counter, and invalid-move counter
- Auto-Solve with animated moves
- Adjustable animation speed (1x–10x)
- Silent gameplay (no sound)

## Project structure

```text
tower-of-hanoi/
├── hanoi.pl
├── index.html
├── README.md
├── .gitignore
├── css/
│   └── style.css
└── js/
    └── game.js
```

## Requirements

- SWI-Prolog installed
- A modern web browser

## Run locally

1. Open a terminal in the project root (the folder containing `hanoi.pl`).
2. Start the server:

   ```bash
   swipl hanoi.pl
   ```

3. Keep the terminal open.
4. Visit [http://localhost:8080](http://localhost:8080).

The frontend calls the Prolog API, so opening `index.html` directly as a file will not run the game correctly.

## API

### `POST /api/move`

Request:

```json
{
  "state": [[3, 2, 1], [], []],
  "from": 0,
  "to": 1
}
```

A valid move returns `valid: true` and the updated peg state. An invalid move returns `valid: false`.

Peg arrays are ordered bottom-to-top, and peg indexes are zero-based (`0`, `1`, `2`).

### `POST /api/solve`

Request:

```json
{
  "disks": 3,
  "pegs": 3
}
```

Returns the sequence of optimal moves for the standard three-peg puzzle.

## Notes

- This implementation supports **three pegs**. The `pegs` field in `/api/solve` must be `3`.
- The server must remain running while the game is being played.
- No Node.js, Python, or WebAssembly is required.

## Credits

Developed by **Jennely E. Parado** — **BSIT 3-A**.
