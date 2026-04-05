const { BrowserWindow, Menu, path } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, frame: false,
    title: "GXCode Native Environment",
    icon: require('path').join(__dirname, "..", "..", "..", "APP", "assets", "logo.png"),
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: require('path').join(__dirname, "..", "..", "..", "preload.js"),
      webviewTag: true,
    },
  });

  win.loadFile(require('path').join(__dirname, "..", "..", "..", "APP", "index.html"));
  Menu.setApplicationMenu(null);

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') win.webContents.toggleDevTools();
  });

  return win;
}

module.exports = { createWindow };
