const express = require('express');
const { getMatches, getMatch, updateMatchResult, createManualMatch, deleteMatch, getUserMatches, updateMatchParticipants } = require('../controllers/matchController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, authorize('administrador', 'organizador', 'profesor'), createManualMatch);
router.delete('/:id', protect, authorize('administrador', 'organizador', 'profesor'), deleteMatch);

router.get('/:tournamentId', protect, getMatches);
router.get('/detail/:id', protect, getMatch);
router.get('/user/:userId', protect, getUserMatches);
router.put('/:id/result', protect, authorize('administrador', 'organizador', 'profesor'), updateMatchResult);
router.put('/:id/participants', protect, authorize('administrador', 'organizador', 'profesor'), updateMatchParticipants);

module.exports = router;
