import neutralino from '@neutralinojs/lib';
neutralino.init();
import * as buntralino from 'buntralino-client';
import './js/main.js';
import './lit/init.ts'
// Sample Bun interaction
(async () => {
    await buntralino.ready;
    const response = await buntralino.run('sayHello', {  message: 'Hello, Buntralino!' });
    // recibe un objeto con la respuesta usando buntralino.run que es una promesa (async/await IPC)
    console.log(response);
})();
async function onFileUpload () {
    //    function showOpenDialog(title?: string, options?: OpenDialogOptions): Promise<string[]>;
    let response = await neutralino.os.showOpenDialog("open")
    const dataresult = {
        response: response,
        Info: await getFileInfo(response)
    }
    console.log(`You've selected: ${response}`,dataresult)
    return dataresult;    
}
async function getFileInfo(name: string | string[]) {
    const Response = await buntralino.run('getFileInfo', name);
    console.log("Response", Response);
}

(window as any).getFileInfo = async (name: string | string[]) => getFileInfo(name);
(window as any).onFileUpload = onFileUpload;