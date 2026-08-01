import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

await rm("assets", { recursive: true, force: true });
await mkdir("assets", { recursive: true });
await cp("pages-build/assets", "assets", { recursive: true });

const html = await readFile("pages-build/index.source.html", "utf8");
await writeFile("index.html", html);
await cp("public/favicon.svg", "favicon.svg");
await writeFile(".nojekyll", "");
