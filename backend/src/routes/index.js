const express = require('express');
const { ItemController } = require('../controllers/index');
const { AuthController } = require('../controllers/authController');
const Item = require('../models/index');

const router = express.Router();
const itemController = new ItemController(Item);
const authController = new AuthController();

function setRoutes(app) {
    router.post('/auth/login', authController.login.bind(authController));
    router.get('/auth/session', authController.session.bind(authController));
    router.post('/auth/logout', authController.logout.bind(authController));

    router.get('/items', itemController.getItems.bind(itemController));
    router.post('/items', itemController.addItem.bind(itemController));

    app.use('/api', router);
}

module.exports = {
    setRoutes
};
