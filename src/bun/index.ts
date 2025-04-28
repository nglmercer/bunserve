let viteHost: string | null = null;
{
    const viteHostArg = process.argv.find((arg) => arg.startsWith('--vitehost'));
    viteHost = viteHostArg?.split('=')[1]!;
}

import {create, events, registerMethodMap} from 'buntralino';
import path from 'path';
import fs from 'fs';
import server from './bunserve';
console.log("Servidor Bun escuchando en http://localhost:" + server.port);
/**
 * Function map that allows running named functions with `buntralino.run` on the client (Neutralino) side.
 */
const functionMap = {
    sayHello: async (payload: {
        message: string
    }) => {
        await Bun.sleep(1000);
        return `Bun says "${payload.message}"!`;
    },
    getPathFile: async (payload: any) => {
        console.log('Archivo recibido:',payload);

    },
    getFileInfo: async (name: string | string[]) => {
        // path absolute verificar si existe
        if (Array.isArray(name)) {
            return name.map((fileName) => {
                const filePath = path.join(fileName);
                console.log('Array recibido:', name, filePath);
                console.log('Archivo recibido:', getFiledata(filePath, fileName));
                return getFiledata(filePath, fileName);
            });
        } else {
            console.log('File path:', name);
            return getFiledata(name, name);
        }
    }
};
function getFiledata(filePath: string, fileName: string) {
    const stats = fs.statSync(filePath);
    return {
        name: fileName,
        path: filePath,
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        extension: path.extname(filePath),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        accessedAt: stats.atime,
        mode: stats.mode.toString(8)
    };
}
registerMethodMap(functionMap);
// or registerMethod('sayHello', functionMap.sayHello);

await create(viteHost ?? '/', {
    // Name windows to easily manipulate them and distinguish them in events
    name: 'main',
    // We need this option to add Neutralino globals to the Vite-hosted page
    injectGlobals: true,
    // Any options for Neutralino.window.create can go here
});
console.log('🚀 Neutralino app is running', process.argv,viteHost);
// Exit the app completely when the main window is closed without the `shutdown` command.
events.on('close', (windowName: string) => {
    if (windowName === 'main') {
        // eslint-disable-next-line no-process-exit
        process.exit();
    }
});