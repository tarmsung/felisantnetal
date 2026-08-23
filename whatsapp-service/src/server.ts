import express, { type NextFunction, type Request, type Response } from "express";
import { startBaileysConnection, getStatus, sendText, logoutAndReset } from "./baileys.js";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3100);
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY is not set — refusing to start. Every non-health endpoint requires it.");
  process.exit(1);
}

/**
 * A liveness probe (this service's own Docker HEALTHCHECK, or an
 * orchestrator) has no API key and shouldn't need one just to confirm
 * the process is up — same reasoning as the main app's /api/health
 * being excluded from its own auth layer. Everything else requires it:
 * this service can send WhatsApp messages on the clinic's behalf, which
 * is not something to leave open on the network.
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (token !== API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

app.get("/status", (_req, res) => {
  res.json(getStatus());
});

app.post("/send", async (req: Request, res: Response) => {
  const { to, message } = req.body ?? {};
  if (typeof to !== "string" || typeof message !== "string" || !to.trim() || !message.trim()) {
    res.status(400).json({ success: false, error: "Both 'to' and 'message' are required strings." });
    return;
  }
  const result = await sendText(to, message);
  res.status(result.success ? 200 : 502).json(result);
});

app.post("/logout", async (_req: Request, res: Response) => {
  await logoutAndReset();
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`WhatsApp service listening on :${PORT}`);
});

startBaileysConnection().catch((err) => {
  console.error("Failed to start WhatsApp connection:", err);
});
