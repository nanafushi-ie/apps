import { cp, copyFile, mkdir, rm } from "node:fs/promises";

await rm("assets", { recursive: true, force: true });
await mkdir("assets", { recursive: true });
await cp("dist/assets", "assets", { recursive: true, force: true });
await rm("icons", { recursive: true, force: true });
await cp("dist/icons", "icons", { recursive: true, force: true });
await copyFile("dist/index.source.html", "index.html");
await copyFile("dist/favicon.svg", "favicon.svg");
await copyFile("dist/og.png", "og.png");
await copyFile("dist/cover-desktop.png", "cover-desktop.png");
await copyFile("dist/cover-mobile.png", "cover-mobile.png");
