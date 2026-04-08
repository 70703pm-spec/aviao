import axios from 'axios';

const API_BASE_URL = (
    process.env.REACT_APP_API_BASE_URL
    || (typeof window === 'undefined'
        ? 'http://localhost:3003'
        : `${window.location.protocol}//${window.location.hostname}:3003`)
).replace(/\/$/, '');
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
