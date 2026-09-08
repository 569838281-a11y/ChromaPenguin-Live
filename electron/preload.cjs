const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("chromaDesktop", {
  isDesktop: true,
  platform: process.platform,
});
