import { fetchapi } from "./fetchapi.js";
import  {
    exactcompareObjectKeys,
    filterRequiredFields,
    validateFields
} from "../utils/verify";
const FileInput = document.getElementById('FileInput');
console.log('FileInput:', FileInput);

const formDataVerify = {
    episode: 0,
    title: '',
    description: '',
    image: '',
    duration: 0,
    catalog_id: 0,
    season_id: 0
};
FileInput.addEventListener('change',async function (e) {
    const { id, name, value, target } = e.detail;
    const file = target.files[0];
    
    if (!file) return;
    const formData = new FormData();
    formData.append('video', file);
    const data2 = getFormData(['episode', 'title', 'description', 'image', 'duration', 'season_id', 'catalog_id'])
    Object.entries(data2).forEach(([key, value]) => formData.append(key, value));
    console.log('FormData:', formData);
    formData.forEach((value, key) => console.log(key, value))
    const validateOBJ = validateFields({
        required: formDataVerify,
        actualObj: data2
    });
    console.log('ValidateOBJ:', validateOBJ,data2);
    const response = await fetchapi.uploadFile(formData);
    console.log('Response:', response); 
    /*
    */
});
function getFormData(keys) {
    let data = {};
    if (!keys) return;
    if (!Array.isArray(keys)) return;
    for (const key of keys) {
        const value = document.getElementById(key)?.value;
        if (value) {
            data[key] = value;
        }
    }
    return data;
}