import { BrowserWindow, Updater, Utils } from "electrobun/bun";

import { startServer } from './server';


const DEV_SERVER_PORT = 5178;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  return "views://mainview/index.html";
}

const server = await startServer();
console.log(`started server on port ${server.port}`);

// Create the main application window
const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
  title: "React + Tailwind + Vite",
  url,
  // frame: {
  //   // width: 900,
  //   // height: 700,
  //   // x: 200,
  //   // y: 200,
  // },
  styleMask: {
    Resizable: true,
    Borderless: true,
    Closable: true,
    FullSizeContentView: true,
  },
});

// Quit the app when the main window is closed
mainWindow.on("close", () => {
  Utils.quit();
});

console.log("React Tailwind Vite app started!");
