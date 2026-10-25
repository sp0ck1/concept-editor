import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = dirname(fileURLToPath(import.meta.url));
let electronPath;

if (process.platform === 'win32') {
	// Use Windows Electron without replacing the checkout's Linux dependencies.
	const globalModules = execFileSync(process.execPath, [process.env.npm_execpath, 'root', '--global'], {
		encoding: 'utf8'
	}).trim();

	electronPath = join(globalModules, 'electron', 'dist', 'electron.exe');

	if (!existsSync(electronPath)) {
		console.error('Windows Electron was not found. Install it with: npm install --global electron@45');
		process.exit(1);
	}
} else {
	const electron = await import('electron');
	electronPath = electron.default;
}

const electron = spawn(electronPath, [projectDirectory], {
	cwd: projectDirectory,
	stdio: 'inherit'
});

electron.on('error', (error) => {
	console.error('Could not launch Electron:', error.message);
	process.exitCode = 1;
});

electron.on('exit', (code) => {
	process.exitCode = code ?? 1;
});
