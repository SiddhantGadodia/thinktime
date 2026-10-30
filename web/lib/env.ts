// Side-effect import for standalone scripts (settler/simulator): loads web/.env.local.
// Next.js loads it on its own for the app.
import { config } from "dotenv";
import path from "node:path";

config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });
