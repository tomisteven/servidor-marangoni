const express = require('express');
const { 
  createTournament, 
  getTournaments, 
  getTournament, 
  enrollPlayer, 
  startTournament,
  deleteTournament,
  adminEnrollPlayer,
  advanceTournament,
  removeInscription,
  addPartner,
  updateZones,
  updateTournament
} = require('../controllers/tournamentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getTournaments);
router.get('/:id', protect, getTournament);
router.post('/', protect, authorize('administrador', 'organizador', 'profesor'), createTournament);
router.put('/:id', protect, authorize('administrador', 'organizador', 'profesor'), updateTournament);
router.post('/:id/enroll', protect, enrollPlayer);
router.post('/:id/start', protect, authorize('administrador', 'organizador', 'profesor'), startTournament);
router.post('/:id/admin-enroll', protect, authorize('administrador', 'organizador', 'profesor'), adminEnrollPlayer);
router.post('/:id/advance', protect, authorize('administrador', 'organizador', 'profesor'), advanceTournament);
router.post('/:id/remove-inscription', protect, authorize('administrador', 'organizador', 'profesor'), removeInscription);
router.post('/:id/add-partner', protect, authorize('administrador', 'organizador', 'profesor'), addPartner);
router.put('/:id/zones', protect, authorize('administrador', 'organizador', 'profesor'), updateZones);
router.delete('/:id', protect, authorize('administrador', 'organizador'), deleteTournament);

module.exports = router;
