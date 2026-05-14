const express = require('express');
const { getGlobalRanking, getPlayerStats } = require('../controllers/statsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/ranking/:disciplina', protect, getGlobalRanking);
router.get('/player/:id', protect, getPlayerStats);

module.exports = router;
