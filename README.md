# Wasteland Derby

Bet on armed horse races at a post-apocalyptic racecourse. A continuous cycle of races runs on the server;
everyone watching sees the same race, bets against fixed odds, and can secretly pay the stable hands for an
edge. Jockeys carry pipes, chains, sawn-offs and crossbows, and they use them.

Spun out of [Ashen Gambit](https://github.com/jaspr123/ashen-gambit), where it started as a side mode.

## How a race works

1. **Betting (45 s).** Eight runners are drawn from a roster of 36 (four stables, nine riders each). The
   server prices every runner by simulating the race many times and posts fixed **win / place / show** odds.
   Bets lock in the odds at the moment you place them.
2. **Back room.** Once you back a horse you can buy secret upgrades for it (nitro oats, plated barding, a
   grapple hook…). Odds don't move, and nobody else knows which horse got what until the race is over.
3. **Gates and the race.** Betting closes, the server simulates the race once with every upgrade included,
   and ships the full timeline to everyone. The client replays it in sync with the server clock, with a
   director camera, follow cam and aerial view.
4. **Results.** Payouts land in your bank, and every secret deal is revealed. A broke punter is topped back up
   to the track stipend.

Simulated **track regulars** bet alongside real players so the board is never empty.

## Run it

```bash
npm install
npm run dev
```

The server runs on `:3002` and the client on `http://localhost:5174`. With no `DATABASE_URL` set, data goes
to a JSON file in `apps/server/data/`.

```bash
npm test
```

| Env | Default | |
| --- | --- | --- |
| `PORT` | `3002` | server port |
| `DATABASE_URL` | unset | Postgres; unset = JSON file store |
| `REGULARS` | `6` | simulated punters (0 disables) |
| `DERBY_FAST` | unset | `1` = short phases + cheap pricing (tests) |
| `ADMIN_NAMES`, `ADMIN_CODE` | unset | admin accounts (reserved for track controls) |

## Layout

```
packages/shared   race data (roster, weapons, upgrades), the deterministic race simulation + odds pricer, protocol
apps/server       Express + Socket.IO: accounts, the race cycle (DerbyManager), track regulars, Postgres/JSON storage
apps/client       React + three.js (react-three-fiber): racecourse, runners, race card, bet slip, back room
tools/blender     build_runners.py builds every horse + rider model from Synty POLYGON packs
```

## 3D models

The horse-and-rider models are built from licensed **Synty POLYGON** packs (Sci-Fi City, Western, Generic,
Spy) plus the CC0 Quaternius horse, so they are **not in git**. A fresh clone runs with simple stand-in
horses in each runner's silks.

To build the real ones, unpack the packs into `.asset-cache/` (same layout as Ashen Gambit's) and run:

```bash
npm run assets:build
npm run assets:optimize -- runners/
```

## Deploy

`Dockerfile` builds one container (server + built client). `deploy/docker-compose.yml` runs it with
Postgres behind Traefik at `https://ai.jteam.ca/WastelandDerby/`; secrets go in `deploy/.env`
(`POSTGRES_PASSWORD`, optional `ADMIN_NAMES`, `ADMIN_CODE`). Include the built `assets/runners` folder in the
build context.
