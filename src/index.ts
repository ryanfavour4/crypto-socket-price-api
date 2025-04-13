import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { IncomingMessage } from "http";
import url from "url";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const binanceSockets: Record<string, WebSocket> = {};
const subscribers: Record<string, Set<WebSocket>> = {};

const createBinanceStream = (symbol: string) => {
    const binanceWS = new WebSocket(
        `wss://stream.binance.com:9443/ws/${symbol}@ticker`
    );

    binanceWS.on("open", () => {
        console.log(`[Binance] Connected to ${symbol}`);
        binanceSockets[symbol] = binanceWS;
    });

    binanceWS.on("message", (data) => {
        subscribers[symbol]?.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data.toString());
            }
        });
    });

    binanceWS.on("close", () => {
        console.log(`[Binance] Closed connection for ${symbol}`);
        if (binanceSockets[symbol]) {
            delete binanceSockets[symbol];
        }
    });

    binanceWS.on("error", (err) => {
        console.error(`[Binance] Error on ${symbol}:`, err.message);
    });
};

server.on("upgrade", (request, socket, head) => {
    const parsedUrl = url.parse(request.url || "", true);
    const symbol = (parsedUrl.pathname || "").replace(/\//g, "").toLowerCase();

    if (!symbol) {
        socket.destroy();
        return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request, symbol);
    });
});

wss.on("connection", (ws: WebSocket, _req: IncomingMessage, symbol: string) => {
    if (!subscribers[symbol]) {
        subscribers[symbol] = new Set();
    }

    subscribers[symbol].add(ws);
    console.log(`Client subscribed to ${symbol}`);

    if (!binanceSockets[symbol]) {
        createBinanceStream(symbol);
    }

    ws.on("close", () => {
        subscribers[symbol]?.delete(ws);
        if (subscribers[symbol]?.size === 0) {
            if (binanceSockets[symbol]) {
                binanceSockets[symbol].close();
            }
            delete subscribers[symbol];
        }
    });
});

server.listen(3001, () => {
    console.log("WebSocket proxy server running on port 3001");
});

// import express from "express";
// import { WebSocketServer, WebSocket } from "ws";
// import http from "http";
// import { IncomingMessage } from "http";

// const app = express();
// const server = http.createServer(app);
// const wss = new WebSocketServer({ server });

// // Track Binance WebSocket streams per symbol
// const binanceSockets: Record<string, WebSocket> = {};
// // Track subscribers per symbol
// const subscribers: Record<string, Set<WebSocket>> = {};

// const createBinanceStream = (symbol: string) => {
//     const binanceWS = new WebSocket(
//         `wss://stream.binance.com:9443/ws/${symbol}@ticker`
//     );
//     console.log("SYMBOL", symbol);

//     binanceWS.on("message", (data) => {
//         console.log("Raw Binance response:", data.toString()); // add this line
//         console.log("DATA ON MESSAGE", data);
//         subscribers[symbol]?.forEach((client) => {
//             if (client.readyState === WebSocket.OPEN) {
//                 client.send(data.toString());
//             }
//         });
//     });

//     binanceWS.on("close", () => {
//         delete binanceSockets[symbol];
//     });

//     binanceSockets[symbol] = binanceWS;
// };

// wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
//     let subscribedSymbols: Set<string> = new Set();

//     ws.on("message", (message) => {
//         try {
//             const parsed = JSON.parse(message.toString());
//             if (parsed.type === "subscribe" && parsed.symbol) {
//                 const symbol = parsed.symbol.toLowerCase();

//                 if (!subscribers[symbol]) {
//                     subscribers[symbol] = new Set();
//                 }

//                 // Add the client to the subscriber list for the symbol
//                 subscribers[symbol].add(ws);
//                 subscribedSymbols.add(symbol);

//                 // Create a new Binance WebSocket stream if not already active
//                 if (!binanceSockets[symbol]) {
//                     createBinanceStream(symbol);
//                 }
//             }
//         } catch (err) {
//             console.error("Failed to handle message:", err);
//             ws.send(JSON.stringify({ error: "Invalid subscription request" }));
//         }
//     });

//     ws.on("close", () => {
//         subscribedSymbols.forEach((symbol) => {
//             subscribers[symbol]?.delete(ws);
//             if (subscribers[symbol]?.size === 0) {
//                 // Close the Binance WebSocket only if no subscribers remain
//                 binanceSockets[symbol]?.close();
//                 delete subscribers[symbol];
//             }
//         });
//     });
// });

// server.listen(3001, () => {
//     console.log("WebSocket proxy server running on port 3001");
// });

