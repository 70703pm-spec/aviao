import React, { useEffect, useState } from 'react';
import { fetchItems } from '../services/api';
import ItemList from '../components/ItemList';

const HomePage = () => {
    const [items, setItems] = useState([]);

    useEffect(() => {
        const loadItems = async () => {
            const fetchedItems = await fetchItems();
            setItems(fetchedItems);
        };
        loadItems();
    }, []);

    return (
        <div>
            <h1>Item List</h1>
            <ItemList items={items} />
        </div>
    );
};

export default HomePage;