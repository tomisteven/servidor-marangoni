const Ranking = require('../models/Ranking');
const PlayerStats = require('../models/PlayerStats');
const User = require('../models/User');

exports.getGlobalRanking = async (req, res, next) => {
  try {
    const { disciplina } = req.params;
    const ranking = await Ranking.findOne({ disciplina, tipo: 'global' });
    const allUsers = await User.find({ 
      disciplinas: disciplina, 
      activo: true,
      rol: 'jugador' 
    }).select('nombre apellido avatar');

    const entradas = allUsers.map(user => {
      const entry = ranking?.entradas.find(e => e.jugadorId.toString() === user._id.toString());
      return {
        jugadorId: user,
        puntos: entry?.puntos || 0,
        partidosJugados: entry?.partidosJugados || 0,
        partidosGanados: entry?.partidosGanados || 0,
        partidosPerdidos: entry?.partidosPerdidos || 0,
        setsGanados: entry?.setsGanados || 0,
        setsPerdidos: entry?.setsPerdidos || 0
      };
    });

    // Sort entries by points
    entradas.sort((a, b) => b.puntos - a.puntos);
    
    res.status(200).json({ success: true, data: { entradas } });
  } catch (error) {
    next(error);
  }
};

exports.getPlayerStats = async (req, res, next) => {
  try {
    const playerId = req.params.id;

    // Always try to find or create the stats document
    let stats = await PlayerStats.findOne({ jugadorId: playerId });
    
    if (!stats) {
      // Verify user exists before creating stats
      const user = await User.findById(playerId).select('nombre apellido avatar email disciplinas rol dni nacionalidad sexo domicilio telefono');
      if (!user) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }
      // Create empty stats document for this player
      stats = await PlayerStats.create({ jugadorId: playerId });
    }

    // Trigger recalculation if stats are zeroed but matches exist
    const Match = require('../models/Match');
    const hasMatches = await Match.exists({
      $or: [
        { jugador1: playerId }, { jugador2: playerId },
        { pareja1: playerId }, { pareja2: playerId }
      ]
    });

    if (hasMatches && stats.porDisciplina.padel.partidosJugados === 0 && stats.porDisciplina.tenis.partidosJugados === 0) {
      try {
        const statsService = require('../services/statsService');
        const playerMatches = await Match.find({
          $or: [
            { jugador1: playerId }, { jugador2: playerId },
            { pareja1: playerId }, { pareja2: playerId }
          ]
        }).populate('torneoId');

        for (const m of playerMatches) {
          if (m.estado === 'finalizado' && m.resultado && m.torneoId) {
            try { await statsService.updatePlayerStats(m, m.torneoId); } catch (e) { console.error(e); }
          }
        }
      } catch (calcError) {
        console.error('Error in stats recalculation:', calcError);
      }

      const Tournament = require('../models/Tournament');
      const playerTournaments = await Tournament.find({
        estado: 'finalizado',
        $or: [{ 'inscripciones.jugador1': playerId }, { 'inscripciones.jugador2': playerId }]
      });

      for (const t of playerTournaments) {
        const dStats = stats.porDisciplina[t.disciplina];
        dStats.torneoJugados += 1;
        const winnerId = t.ganador?.toString();
        if (winnerId) {
          if (t.disciplina === 'padel') {
            const winningInsc = t.inscripciones.find(i => i.jugador1?.toString() === winnerId || i.jugador2?.toString() === winnerId);
            if (winningInsc && (winningInsc.jugador1?.toString() === playerId || winningInsc.jugador2?.toString() === playerId)) {
              dStats.torneoGanados += 1;
            }
          } else if (winnerId === playerId) {
            dStats.torneoGanados += 1;
          }
        }
      }
      await stats.save();
    }

    // Always re-fetch with full population
    const populated = await PlayerStats.findOne({ jugadorId: playerId })
      .populate('jugadorId', 'nombre apellido avatar email disciplinas rol dni nacionalidad sexo domicilio telefono')
      .populate('historialVsJugadores.rivalId', 'nombre apellido avatar');

    if (!populated || !populated.jugadorId) {
      // jugadorId could not be populated → return a clean fallback with user data
      const user = await User.findById(playerId).select('nombre apellido avatar email disciplinas rol dni nacionalidad sexo domicilio telefono');
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return res.status(200).json({
        success: true,
        data: {
          jugadorId: user,
          porDisciplina: {
            padel: { partidosJugados: 0, ganados: 0, perdidos: 0, torneoGanados: 0, torneoJugados: 0, setsGanados: 0, setsPerdidos: 0, rachaActual: 0, mejorRacha: 0 },
            tenis: { partidosJugados: 0, ganados: 0, perdidos: 0, torneoGanados: 0, torneoJugados: 0, setsGanados: 0, setsPerdidos: 0, rachaActual: 0, mejorRacha: 0 }
          },
          historialVsJugadores: []
        }
      });
    }

    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/stats/rebuild  (admin only)
 * Wipes all PlayerStats + Ranking and rebuilds them from existing Match documents.
 */
exports.rebuildAllStats = async (req, res, next) => {
  try {
    const Match = require('../models/Match');
    const Ranking = require('../models/Ranking');
    const Tournament = require('../models/Tournament');
    const statsService = require('../services/statsService');

    // 1. Wipe derived collections
    await PlayerStats.deleteMany({});
    await Ranking.deleteMany({});

    // 2. Re-process every finalizado match
    const matches = await Match.find({ estado: 'finalizado' })
      .populate('torneoId')
      .populate('jugador1', '_id nombre')
      .populate('jugador2', '_id nombre')
      .populate('pareja1', '_id nombre')
      .populate('pareja2', '_id nombre');

    let processed = 0;
    let skipped = 0;
    for (const m of matches) {
      if (!m.torneoId || !m.resultado?.ganador) { skipped++; continue; }
      try {
        await statsService.updatePlayerStats(m, m.torneoId);
        processed++;
      } catch (e) {
        skipped++;
      }
    }

    // 3. Award tournament wins & torneoJugados
    const finishedTournaments = await Tournament.find({ estado: 'finalizado', ganador: { $exists: true, $ne: null } });
    for (const t of finishedTournaments) {
      const disc = t.disciplina;
      const winnerId = t.ganador?.toString();

      for (const insc of (t.inscripciones || [])) {
        const ids = [insc.jugador1, insc.jugador2].filter(Boolean);
        for (const pId of ids) {
          let stats = await PlayerStats.findOne({ jugadorId: pId });
          if (!stats) stats = await PlayerStats.create({ jugadorId: pId });
          stats.porDisciplina[disc].torneoJugados += 1;
          if (
            winnerId && (
              insc.jugador1?.toString() === winnerId ||
              insc.jugador2?.toString() === winnerId
            )
          ) {
            stats.porDisciplina[disc].torneoGanados += 1;
          }
          await stats.save();
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Reconstrucción completada. Partidos procesados: ${processed}, Omitidos: ${skipped}.`
    });
  } catch (error) {
    next(error);
  }
};
