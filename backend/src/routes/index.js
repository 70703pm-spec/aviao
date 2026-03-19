const express = require('express');
const ItemController = require('../controllers/index').ItemController;

const router = express.Router();
const itemController = new ItemController();

function setRoutes(app) {
    router.get('/items', itemController.getItems.bind(itemController));
    router.post('/items', itemController.addItem.bind(itemController));
    
    app.use('/api', router);
}

module.exports = setRoutes;