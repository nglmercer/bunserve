import { fetchapi } from "./fetchapi.js";
const FileInput = document.getElementById('uploadFile');
const FileContent = document.getElementById('fileContent');

FileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];

    if (file) {
        console.log('File selected:', file.name);
    }
    const formData = new FormData();
    formData.append('video', file);
    console.log('FormData:', formData);
    formData.forEach((value, key) => console.log(key, value))
/*     const response = await fetchapi.uploadFile(formData);
    console.log('Response:', response); */
});