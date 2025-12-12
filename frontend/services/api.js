import axios from 'axios';

// Change this to your backend URL
const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Projects
export const getProjects = () => api.get('/projects');
export const createProject = (data) => api.post('/projects', data);
export const getProjectDetails = (id) => api.get(`/projects/${id}`);

// Tasks
export const getTasks = (status) => {
    const params = status ? { status } : {};
    return api.get('/tasks', { params });
};
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data);
export const uploadTaskAttachment = async (taskId, fileUri, fileName) => {
    const formData = new FormData();
    formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: 'application/octet-stream',
    });
    return api.post(`/tasks/${taskId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

export default api;
