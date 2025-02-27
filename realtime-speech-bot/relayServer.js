import { WebSocketServer } from 'ws';
import { RealtimeClient } from '@openai/realtime-api-beta';

export class RealtimeRelay {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.sockets = new WeakMap();
    this.wss = null;
    this.maxRetries = 3;  // Maximum number of retries for OpenAI connection
  }

  listen(port) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', this.connectionHandler.bind(this));
    this.log(`Listening on ws://localhost:${port}`);
  }

  async connectionHandler(ws, req) {
    if (!req.url) {
      this.log('No URL provided, closing connection.');
      ws.close();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname !== '/') {
      this.log(`Invalid pathname: "${pathname}"`);
      ws.close();
      return;
    }

    // Instantiate new OpenAI Realtime client
    const client = new RealtimeClient({ apiKey: this.apiKey });
    const messageQueue = [];
    let retries = 0;

    // Define the message handler
    const messageHandler = (data) => {
      try {
        const event = JSON.parse(data);
        this.log(`Relaying "${event.type}" to OpenAI`);
        client.realtime.send(event.type, event);
      } catch (e) {
        this.log(`Error parsing client event: ${e.message}`);
      }
    };

    // Handle messages from the client (browser)
    ws.on('message', (data) => {
      if (!client.isConnected()) {
        this.log(`OpenAI connection not ready. Queueing message.`);
        messageQueue.push(data);  // Queue messages if OpenAI connection is not ready
      } else {
        messageHandler(data);
      }
    });

    ws.on('close', () => {
      this.log('Client WebSocket closed');
      client.disconnect();
    });

    // Relay: OpenAI Realtime API Event -> Browser Event
    client.realtime.on('server.*', (event) => {
      this.log(`Relaying "${event.type}" to Client`);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(event));
      } else {
        this.log('Client WebSocket is not open. Dropping message.');
      }
    });

    client.realtime.on('close', () => {
      this.log('OpenAI WebSocket closed');
      if (retries < this.maxRetries) {
        retries++;
        this.log(`Retrying connection to OpenAI (${retries}/${this.maxRetries})...`);
        this.connectToOpenAI(client, ws, messageQueue, retries);
      } else {
        this.log(`Max retries reached. Closing connection.`);
        ws.close();
      }
    });

    // Connect to OpenAI Realtime API
    this.connectToOpenAI(client, ws, messageQueue, retries);
  }

  async connectToOpenAI(client, ws, messageQueue, retries) {
    try {
      this.log(`Connecting to OpenAI... (attempt ${retries + 1})`);
      await client.connect();
      this.log(`Connected to OpenAI successfully!`);

      // Send any queued messages once connected
      while (messageQueue.length) {
        const message = messageQueue.shift();
        this.log('Processing queued message');
        this.messageHandler(message);
      }
    } catch (e) {
      this.log(`Error connecting to OpenAI: ${e.message}`);
      ws.close();
    }
  }

  log(...args) {
    console.log(`[RealtimeRelay]`, ...args);
  }
}
