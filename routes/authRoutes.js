const express = require('express');
const { register, login, logout, getMe, refresh, getUsers, updateProfile, toggleUserStatus, adminUpdateUser, updateUserRanking } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/refresh', refresh);
router.get('/me', protect, getMe);
router.get('/users', protect, authorize('administrador', 'organizador'), getUsers);
router.put('/update-profile', protect, updateProfile);
router.put('/update/:id', protect, authorize('administrador'), adminUpdateUser);
router.put('/toggle-status/:id', protect, authorize('administrador'), toggleUserStatus);
router.put('/ranking/:userId', protect, authorize('administrador'), updateUserRanking);

module.exports = router;
