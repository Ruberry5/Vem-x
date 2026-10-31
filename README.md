# VEM X — Version 1

A mobile-first browser multiplayer survival arena. The current repository uses a root-level Vite frontend and Express/Socket.IO server.

## Run locally
Requires Node.js 20+.

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173  
Realtime server: http://localhost:3001  
Health check: http://localhost:3001/health

## Deployment
- Render Web Service: repository root, build command `npm install`, start command `npm start`.
- Vercel: repository root, framework Vite, build command `npm run build`, output directory `dist`.
- Set Vercel `VITE_SERVER_URL` to the actual Render service URL.
- Set Render `CLIENT_ORIGIN` to the actual Vercel deployment URL.
- Deployments are not considered live until both providers report successful deployment and the health endpoint is verified.

## V1 status
The current implementation includes room creation/joining, crew selection, 4-character room codes, a 5-second rules phase, 10-second drop, an 8×8 arena, and a server-managed survival phase. Multi-stage zone progression and fair final showdown still require implementation and testing; this is not yet a completed release.
