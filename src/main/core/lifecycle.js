const { app, BrowserWindow } = require('electron');

function setupLifecycle() {
    if (!app.requestSingleInstanceLock()) {
      console.log("[GXCode] Istanza già in esecuzione. Chiusura...");
      app.quit();
      return false;
    }

    app.on('second-instance', () => {
      const wins = BrowserWindow.getAllWindows();
      if (wins.length > 0) {
        if (wins[0].isMinimized()) wins[0].restore();
        wins[0].focus();
      }
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") app.quit();
    });
    
    return true;
}

module.exports = { setupLifecycle };
