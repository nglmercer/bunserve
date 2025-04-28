import {
    DynObjDisp,
    ObjEditFrm,
    CDlg,
    DlgCont,
    CInp
} from './modal.js';
import { DialogContent, DialogContainer } from './custom-modal.js';
import {CInput} from './CInput.js';
// Declare custom elements for improved autocompletion in HTML templates
declare global {
    interface HTMLElementTagNameMap {
        'dyn-obj-disp': DynObjDisp;
        'obj-edit-frm': ObjEditFrm;
        'c-dlg': CDlg;
        'dlg-cont': DlgCont;
        'c-inp': CInp;
        'dialog-content': DialogContent;
        'dialog-container': DialogContainer;
        'c-input': CInput;
    }
}

/**

function createPromiseDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
        const dialogContainer = document.createElement('dialog-container') as DialogContainer;
        dialogContainer.id = 'promise-dialog';

        const dialogContent = document.createElement('dialog-content') as DialogContent;
        dialogContent.title = 'Confirmar acción';
        dialogContent.description = message;

        dialogContent.options = [
            {
                label: 'Cancelar',
                class: 'cancel-btn',
                callback: () => {
                    resolve(false);
                    dialogContainer.hide();
                    setTimeout(() => dialogContainer.remove(), 300);
                }
            },
            {
                label: 'Aceptar',
                class: 'save-btn',
                callback: () => {
                    resolve(true);
                    dialogContainer.hide();
                    setTimeout(() => dialogContainer.remove(), 300);
                }
            }
        ];

        dialogContainer.appendChild(dialogContent);
        document.body.appendChild(dialogContainer);
        dialogContainer.show();
    });
}
/*

// Ejemplo de uso del diálogo con Promise
 async function usageExample() {
    // Crear un botón para abrir el diálogo
    const button = document.createElement('button');
    button.textContent = 'Abrir diálogo con Promise';
    document.body.appendChild(button);

    button.addEventListener('click', async () => {
        const result = await createPromiseDialog('¿Deseas continuar con esta operación?');

        if (result) {
            console.log('Usuario aceptó');
            // Realizar acción
        } else {
            console.log('Usuario canceló');
            // Cancelar acción
        }
    });
}
usageExample()  
*/