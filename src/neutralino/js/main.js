import { fetchapi } from "./fetchapi.js";
const FileInput = document.getElementById('FileInput');
console.log('FileInput:', FileInput);
FileInput.addEventListener('change', function (e) {
    const { id, name, value, target } = e.detail;
    const file = target.files[0];

    if (!file) return;
    const formData = new FormData();
    formData.append('video', file);
    console.log('FormData:', formData);
    formData.forEach((value, key) => console.log(key, value))
/*     const response = await fetchapi.uploadFile(formData);
    console.log('Response:', response); */
});