import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface PlayerState {
  id: string;
  name: string;
  carId: string;
  color: string;
  trackId: string;
  pos: { x: number; y: number; z: number };
  dir: number;
  speed: number;
  health: number;
  lap: number;
  checkpoint: number;
  finished: boolean;
  finishTime?: number;
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = 3000;

// Track active players in memory
// Key: playerId, Value: PlayerState & socket reference
const activePlayers = new Map<string, { state: PlayerState; ws: WebSocket }>();

// Periodic state broadcast (30Hz)
setInterval(() => {
  // Group players by trackId for localized room broadcasts
  const tracks = new Map<string, PlayerState[]>();
  activePlayers.forEach(({ state }) => {
    if (!tracks.has(state.trackId)) {
      tracks.set(state.trackId, []);
    }
    tracks.get(state.trackId)!.push(state);
  });

  // Send state updates to players in each track room
  tracks.forEach((playersInTrack, trackId) => {
    const payload = JSON.stringify({
      type: "state_update",
      players: playersInTrack,
    });

    activePlayers.forEach(({ state, ws }) => {
      if (state.trackId === trackId && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  });
}, 33); // ~30 fps state updates

// Handle upgrade from HTTP to WebSockets
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws: WebSocket) => {
  let playerId = "";
  let currentTrackId = "";

  ws.on("message", (message: string) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "join") {
        playerId = data.playerId || `player_${Math.random().toString(36).substr(2, 9)}`;
        currentTrackId = data.trackId || "track_city";

        const initialState: PlayerState = {
          id: playerId,
          name: data.name || "Racer",
          carId: data.carId || "car_exotic",
          color: data.color || "#10b981",
          trackId: currentTrackId,
          pos: data.pos || { x: 0, y: 0, z: 0 },
          dir: data.dir || 0,
          speed: data.speed || 0,
          health: data.health || 100,
          lap: data.lap || 1,
          checkpoint: data.checkpoint || 0,
          finished: data.finished || false,
        };

        activePlayers.set(playerId, { state: initialState, ws });

        // Confirm join back to player
        ws.send(JSON.stringify({
          type: "join_ack",
          playerId,
        }));

        // Broadcast to others in the room
        const joinPayload = JSON.stringify({
          type: "player_joined",
          player: initialState,
        });

        activePlayers.forEach(({ state, ws: clientWs }) => {
          if (state.trackId === currentTrackId && clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(joinPayload);
          }
        });
      }

      if (data.type === "update") {
        if (!playerId) return;
        const playerEntry = activePlayers.get(playerId);
        if (playerEntry) {
          // Update position, orientation, speed, health, etc.
          playerEntry.state.pos = data.pos || playerEntry.state.pos;
          playerEntry.state.dir = data.dir !== undefined ? data.dir : playerEntry.state.dir;
          playerEntry.state.speed = data.speed !== undefined ? data.speed : playerEntry.state.speed;
          playerEntry.state.health = data.health !== undefined ? data.health : playerEntry.state.health;
          playerEntry.state.lap = data.lap !== undefined ? data.lap : playerEntry.state.lap;
          playerEntry.state.checkpoint = data.checkpoint !== undefined ? data.checkpoint : playerEntry.state.checkpoint;
          playerEntry.state.finished = data.finished !== undefined ? data.finished : playerEntry.state.finished;
          playerEntry.state.finishTime = data.finishTime !== undefined ? data.finishTime : playerEntry.state.finishTime;
        }
      }

      // Handle chat messaging or emoji ping broadcasts
      if (data.type === "chat" || data.type === "emoji") {
        const payload = JSON.stringify({
          type: data.type,
          playerId,
          senderName: data.senderName,
          text: data.text,
        });

        activePlayers.forEach(({ state, ws: clientWs }) => {
          if (state.trackId === currentTrackId && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(payload);
          }
        });
      }
    } catch (err) {
      console.error("Error parsing WebSocket message:", err);
    }
  });

  ws.on("close", () => {
    if (playerId) {
      activePlayers.delete(playerId);

      // Notify others in room
      const leavePayload = JSON.stringify({
        type: "player_left",
        playerId,
      });

      activePlayers.forEach(({ state, ws: clientWs }) => {
        if (state.trackId === currentTrackId && clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(leavePayload);
        }
      });
    }
  });
});

// Serve health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", players: activePlayers.size });
});

// Configure Vite or Static Serve middleware
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT} [Mode: ${process.env.NODE_ENV || "development"}]`);
  });
}

setupServer();
