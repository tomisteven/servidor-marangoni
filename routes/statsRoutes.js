const express = require('express');
const { getGlobalRanking, getPlayerStats, rebuildAllStats } = require('../controllers/statsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/ranking/:disciplina', protect, getGlobalRanking);
router.get('/player/:id', protect, getPlayerStats);
router.post('/rebuild', protect, authorize('administrador'), rebuildAllStats);

module.exports = router;
