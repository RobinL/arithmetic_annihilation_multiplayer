# Arithmetic Annihilation: multiplayer

A desktop-first, two-player tower-defence maths game built with Vite, React, TypeScript, WebRTC and PeerJS.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL in two browser windows. Create a match in one window, copy the six-character invite code, and join from the other. Each player may choose a different maths level.

For a quick single-window check, choose the practice battle on the start screen.

## GitHub Pages

The live game is deployed at:

https://robinl.github.io/arithmetic_annihilation_multiplayer/

Every push to `main` runs the test suite, builds the Vite app and publishes `dist/` through GitHub Pages.

To build the same production output locally:

```bash
npm run build
```

Vite uses a relative asset base, so the build works from the repository subpath.

## Multiplayer model

- PeerJS supplies the invite-code signalling connection; gameplay data travels peer-to-peer over WebRTC.
- Every peer runs the complete fixed-step combat simulation locally, including flow-field pathfinding, tower targeting, projectiles, collisions and damage.
- WebRTC normally carries only host-sequenced commands scheduled a few simulation ticks ahead. Entity positions are not continuously streamed.
- The host sends periodic state checksums. A full authoritative snapshot is transferred only if a peer detects divergence or needs to recover.
- Players and sides are separate records. The engine already accepts an array of players assigned to either team, so a future lobby can add 2v2 or 3v3 slots without changing the combat-state format.
- Each browser generates questions at its player's chosen school-year level. Successful answers become deterministic commands in the shared event stream.
- Comeback balancing is isolated in `src/game/config.ts` and `src/game/engine.ts` so its thresholds and multipliers can be tuned or disabled.

The original single-player game and its assets are treated as reference material and are not modified by this project.
