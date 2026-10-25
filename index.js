import { app, BrowserWindow } from 'electron'; 


app.on('ready', () => {
	const mainWindow = new BrowserWindow({
			width: 1280,
			height: 720
		});
	mainWindow.loadURL('http://localhost:5173');
	mainWindow.webContents.openDevTools();
});

app.on('window-all-closed', () => {
	app.quit();
});
