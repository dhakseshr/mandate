// Tiny static server with HTTP Range support (needed to seek the film). Usage: npm run booth
import { createServer } from "node:http";
import { createReadStream, statSync, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".webm": "video/webm", ".png": "image/png", ".js": "text/javascript", ".css": "text/css" };

createServer((req, res) => {
  const path = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  let file = join(ROOT, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  const size = statSync(file).size;
  const type = TYPES[extname(file)] ?? "application/octet-stream";
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (m) {
    const start = m[1] ? +m[1] : 0;
    const end = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" });
  createReadStream(file).pipe(res);
}).listen(8765, "127.0.0.1", () => console.log("Voiceover booth: http://localhost:8765/teleprompter/"));
