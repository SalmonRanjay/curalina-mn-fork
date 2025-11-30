import { WebSocketServer } from 'ws';
import { onProgress } from './progress-emitter';
import { log } from './vite';
export const setupWebSocket = (server) => {
    const wss = new WebSocketServer({ server });
    const connections = new Set();
    wss.on('connection', (ws, req) => {
        const url = req.url || '';
        const match = url.match(/\/ws\/render-progress\/(.+)/);
        const sessionId = match ? match[1] : null;
        if (!sessionId) {
            log('[WebSocket] Connection failed: No session ID provided.');
            ws.close();
            return;
        }
        const connection = {
            socket: ws,
            sessionId,
        };
        connections.add(connection);
        log(`[WebSocket] Client connected for session: ${sessionId}`);
        ws.on('close', () => {
            connections.delete(connection);
            log(`[WebSocket] Client disconnected for session: ${sessionId}`);
        });
        ws.on('error', (error) => {
            log(`[WebSocket] Error for session ${sessionId}: ${error.message}`);
            connections.delete(connection);
        });
    });
    onProgress(update => {
        for (const conn of connections) {
            if (conn.sessionId === update.sessionId) {
                conn.socket.send(JSON.stringify(update));
            }
        }
    });
    log('[WebSocket] Server setup complete.');
};
//# sourceMappingURL=webSocket.js.map