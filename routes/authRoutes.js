const express = require('express');
const router  = express.Router();

const { register, login, getMe, updateProfile, changePassword, deleteAccount } = require('../controllers/authController');
const { protect }                     = require('../middleware/auth');
const { validate, registerRules, loginRules } = require('../middleware/validate');

router.post('/register', registerRules, validate, register);
router.post('/login',    loginRules,    validate, login);
router.get ('/me',       protect, getMe);
router.put ('/profile',  protect, updateProfile);
router.put ('/password', protect, changePassword);
router.delete('/me',     protect, deleteAccount);

module.exports = router;
