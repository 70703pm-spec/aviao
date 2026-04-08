const express = require('express');
const { ItemController } = require('../controllers/index');
const { AuthController } = require('../controllers/authController');
const Item = require('../models/index');

const router = express.Router();
const itemController = new ItemController(Item);
const authController = new AuthController();

function setRoutes(app) {
    router.post('/auth/register', authController.register.bind(authController));
    router.post('/auth/login', authController.login.bind(authController));
    router.get('/auth/providers', authController.providers.bind(authController));
    router.get('/auth/oauth/:provider', authController.startOAuth.bind(authController));
    router.get('/auth/oauth/:provider/callback', authController.handleOAuthCallback.bind(authController));
    router.get('/auth/session', authController.session.bind(authController));
    router.post('/auth/logout', authController.logout.bind(authController));

    router.get('/items', itemController.getItems.bind(itemController));
    router.post('/items', itemController.addItem.bind(itemController));

    app.use('/api', router);
}

module.exports = {
    setRoutes
};
