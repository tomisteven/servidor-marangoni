const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const statsService = require('../services/statsService');

exports.createManualMatch = async (req, res, next) => {
  try {
    const { torneoId, ronda, numeroPartido, jugador1, jugador2 } = req.body;
    const match = await Match.create({
      torneoId,
      ronda,
      numeroPartido,
      jugador1,
      jugador2,
      estado: 'pendiente'
    });
    res.status(201).json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
};

exports.deleteMatch = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    
    await match.deleteOne();
    res.status(200).json({ success: true, message: 'Match deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getMatch = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('jugador1', 'nombre apellido avatar')
      .populate('jugador2', 'nombre apellido avatar')
      .populate('pareja1', 'nombre apellido avatar')
      .populate('pareja2', 'nombre apellido avatar');
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    res.status(200).json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
};

exports.getMatches = async (req, res, next) => {
  try {
    const matches = await Match.find({ torneoId: req.params.tournamentId })
      .populate('jugador1', 'nombre apellido avatar')
      .populate('jugador2', 'nombre apellido avatar')
      .populate('pareja1', 'nombre apellido avatar')
      .populate('pareja2', 'nombre apellido avatar')
      .sort({ ronda: 1, numeroPartido: 1 });
    res.status(200).json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
};

exports.updateMatchResult = async (req, res, next) => {
  try {
    const { sets, ganador } = req.body;
    const match = await Match.findById(req.params.id);
    
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    
    match.resultado = { sets, ganador };
    match.estado = 'finalizado';
    match.cargadoPor = req.user.id;
    await match.save();

    const tournament = await Tournament.findById(match.torneoId);
    const isDoubles = tournament.disciplina === 'padel';

    // Logic to advance winner in bracket matches (matches without a group)
    if (!match.grupo) {
      const nextRound = match.ronda + 1;
      const nextMatchNum = Math.ceil(match.numeroPartido / 2);
      const isSlot1InNext = match.numeroPartido % 2 !== 0;

      const nextMatch = await Match.findOne({
        torneoId: tournament._id,
        ronda: nextRound,
        numeroPartido: nextMatchNum,
        tipoCuadro: match.tipoCuadro // Mantener el mismo cuadro (principal o perdedores)
      });

      if (nextMatch) {
        if (isDoubles) {
          const winnerId = match.resultado?.ganador?._id || match.resultado?.ganador;
          const p1IsWinner = match.pareja1?.some(p => (p._id || p).toString() === winnerId?.toString());
          const winnerPair = p1IsWinner ? match.pareja1 : match.pareja2;
            
          if (isSlot1InNext) {
            nextMatch.pareja1 = winnerPair;
          } else {
            nextMatch.pareja2 = winnerPair;
          }
        } else {
          if (isSlot1InNext) {
            nextMatch.jugador1 = ganador;
          } else {
            nextMatch.jugador2 = ganador;
          }
        }
        await nextMatch.save();
      } else {
        // ¡Esta fue una final!
        if (match.tipoCuadro === 'perdedores') {
          tournament.ganadorSecundario = ganador;
        } else {
          tournament.ganador = ganador;
        }

        // El torneo solo finaliza si ya tenemos ambos ganadores (o si solo hay un cuadro)
        const needsTwoWinners = tournament.formato === 'eliminacion_directa_perdedores';
        const bothWinnersSet = tournament.ganador && tournament.ganadorSecundario;

        if (!needsTwoWinners || bothWinnersSet) {
          tournament.estado = 'finalizado';
        }
        
        await tournament.save();
        await statsService.awardTournamentPoints(tournament);
      }
    }

    // Update PlayerStats and Ranking
    await statsService.updatePlayerStats(match, tournament);

    res.status(200).json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
};

exports.getUserMatches = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const matches = await Match.find({
      $or: [
        { jugador1: userId },
        { jugador2: userId },
        { pareja1: userId },
        { pareja2: userId }
      ]
    })
    .populate('torneoId', 'nombre disciplina categoria')
    .populate('jugador1', 'nombre apellido avatar')
    .populate('jugador2', 'nombre apellido avatar')
    .populate('pareja1', 'nombre apellido avatar')
    .populate('pareja2', 'nombre apellido avatar')
    .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
};
exports.updateMatchParticipants = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { jugador1, jugador2, pareja1, pareja2 } = req.body;

    const match = await Match.findById(id);
    if (!match) return res.status(404).json({ success: false, message: 'Partido no encontrado' });

    const tournament = await Tournament.findById(match.torneoId);
    if (tournament.organizadorId.toString() !== req.user.id && req.user.rol !== 'administrador') {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    if (jugador1 !== undefined) match.jugador1 = jugador1 || null;
    if (jugador2 !== undefined) match.jugador2 = jugador2 || null;
    if (pareja1 !== undefined) match.pareja1 = pareja1 || [];
    if (pareja2 !== undefined) match.pareja2 = pareja2 || [];

    await match.save();
    res.status(200).json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
};
