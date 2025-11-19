import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Resolve absolute path to /sandbox/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env");

dotenv.config({ path: envPath });

// Correct import path
import steps from "./scenarios/longScenario.js";
import { runScenario } from "./scenarios/pdScenarioEngine.js";

await runScenario("10-Minute PD Flow", steps);

