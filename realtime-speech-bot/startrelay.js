import { RealtimeRelay } from './relayServer.js';
import dotenv from 'dotenv';

dotenv.config();

const port = 8081;  // Port where the relay server will run
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('OPENAI_API_KEY is not defined in .env file');
  process.exit(1);
}

const relay = new RealtimeRelay(apiKey);
relay.listen(port);
