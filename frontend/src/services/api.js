import axios from 'axios';

function getDefaultApiBaseUrl() {
    if (typeof window === 'undefined') {
        return process.env.REACT_APP_API_BASE_URL || 'http://localhost:3003';
    }

    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    if (!isLocalhost) {
        const forceExternalApi = String(process.env.REACT_APP_FORCE_EXTERNAL_API || '').toLowerCase() === 'true';
        return forceExternalApi && process.env.REACT_APP_API_BASE_URL
            ? process.env.REACT_APP_API_BASE_URL
            : window.location.origin;
    }

    return process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3003`;
}

const API_BASE_URL = getDefaultApiBaseUrl().replace(/\/$/, '');
const API_URL = `${API_BASE_URL}/api/items`;

export const fetchItems = async () => {
    try {
        const response = await axios.get(API_URL);
        return response.data;
    } catch (error) {
        console.error('Error fetching items:', error);
        throw error;
    }
};

export const createItem = async (item) => {
    try {
        const response = await axios.post(API_URL, item);
        return response.data;
    } catch (error) {
        console.error('Error creating item:', error);
        throw error;
    }
};
