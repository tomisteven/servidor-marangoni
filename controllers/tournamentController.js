const Tournament = require('../models/Tournament');
const User = require('../models/User');
const bracketService = require('../services/bracketService');
const statsService = require('../services/statsService');

exports.createTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.create({
      ...req.body,
      organizadorId: req.user.id
    });
    res.status(201).json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

exports.getTournaments = async (req, res, next) => {
  try {
    const tournaments = await Tournament.find()
      .populate('organizadorId', 'nombre apellido')
      .populate('ganador', 'nombre apellido');
    res.status(200).json({ success: true, data: tournaments });
  } catch (error) {
    next(error);
  }
};

exports.getTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('organizadorId', 'nombre apellido avatar')
      .populate('inscripciones.jugador1', 'nombre apellido avatar')
      .populate('inscripciones.jugador2', 'nombre apellido avatar')
      .populate('ganador', 'nombre apellido avatar')
      .populate('zonas.jugadores', 'nombre apellido avatar');
    
    if (!tournament) return res.status(404).json({ success: false, message: 'Torneo no encontrado' });
    res.status(200).json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

exports.enrollPlayer = async (req, res, next) => {
  try {
    const { tournamentId, jugador2Id } = req.body;
    const tournament = await Tournament.findById(tournamentId);

    if (tournament.estado !== 'inscripcion') {
      return res.status(400).json({ success: false, message: 'Inscriptions closed' });
    }

    if (tournament.inscripciones.length >= tournament.maxJugadores) {
      return res.status(400).json({ success: false, message: 'Tournament full' });
    }

    // Check if already enrolled (as jugador1 or jugador2)
    const alreadyEnrolled = tournament.inscripciones.some(i => 
      i.jugador1.toString() === req.user.id || 
      (i.jugador2 && i.jugador2.toString() === req.user.id)
    );

    if (alreadyEnrolled) {
      return res.status(400).json({ success: false, message: 'Already enrolled' });
    }

    // Rule relaxed: allow single player in padel for now, partner can be added later
    /*
    if (tournament.disciplina === 'padel' && !jugador2Id) {
      return res.status(400).json({ success: false, message: 'Padel requires a partner' });
    }
    */

    tournament.inscripciones.push({
      jugador1: req.user._id,
      jugador2: jugador2Id || null
    });

    await tournament.save();
    res.status(200).json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

exports.startTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

    if (tournament.inscripciones.length < tournament.minJugadores) {
      return res.status(400).json({ success: false, message: 'Not enough players' });
    }

    tournament.estado = 'en_curso';
    
    // Generate Bracket
    const players = tournament.inscripciones;
    // Simple shuffle
    const shuffledPlayers = players.sort(() => 0.5 - Math.random());

    const isDoubles = tournament.disciplina === 'padel';

    let bracketInfo;
    if (tournament.formato === 'grupos_+_eliminacion') {
      bracketInfo = await bracketService.generateGroups(tournament._id, shuffledPlayers, 4, isDoubles);
    } else if (tournament.formato === 'eliminacion_directa_perdedores' || tournament.formato === 'grupos_1y2_eliminacion') {
      // Para estos formatos, las zonas se crearon manualmente.
      // Generamos los partidos de Round Robin para cada zona.
      for (const zona of tournament.zonas) {
        const participants = zona.jugadores;
        const n = participants.length;
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            await require('../models/Match').create({
              torneoId: tournament._id,
              ronda: 1,
              numeroPartido: tournament.zonas.indexOf(zona) * 100 + (i * 10 + j),
              grupo: zona.nombre,
              estado: 'pendiente',
              jugador1: isDoubles ? undefined : participants[i],
              jugador2: isDoubles ? undefined : participants[j],
              pareja1: isDoubles ? [participants[i]] : undefined,
              pareja2: isDoubles ? [participants[j]] : undefined
            });
          }
        }
      }
      bracketInfo = { type: 'groups', numGroups: tournament.zonas.length };
    } else {
      return res.status(400).json({ success: false, message: 'Formato de torneo no soportado' });
    }
    
    tournament.bracket = bracketInfo;
    await tournament.save();

    res.status(200).json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

exports.deleteTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

    if (tournament.organizadorId.toString() !== req.user.id && req.user.rol !== 'administrador') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this tournament' });
    }

    const Match = require('../models/Match');
    await Match.deleteMany({ torneoId: tournament._id });
    await tournament.deleteOne();

    res.status(200).json({ success: true, message: 'Tournament deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.adminEnrollPlayer = async (req, res, next) => {
  try {
    const { jugador1Id, jugador2Id } = req.body;
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: 'Torneo no encontrado' });

    const isEnrolled = tournament.inscripciones.some(
      i => i.jugador1.toString() === jugador1Id || (i.jugador2 && i.jugador2.toString() === jugador1Id)
    );

    if (isEnrolled) {
      return res.status(400).json({ success: false, message: 'Player already enrolled' });
    }

    tournament.inscripciones.push({
      jugador1: jugador1Id,
      jugador2: jugador2Id || null
    });
    
    await tournament.save();
    res.status(200).json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

exports.advanceTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    const isDoubles = tournament.disciplina === 'padel';
    const Match = require('../models/Match');
    
    // Solo avanzamos si estamos en fase de grupos
    const matches = await Match.find({ torneoId: tournament._id, grupo: { $exists: true } });
    
    if (matches.length > 0 && matches.some(m => m.estado !== 'finalizado')) {
      return res.status(400).json({ success: false, message: 'Todos los partidos de grupo deben estar finalizados' });
    }

    // Limpiar brackets previos si existen (para evitar duplicados al re-avanzar)
    await Match.deleteMany({ 
      torneoId: tournament._id, 
      $or: [
        { grupo: { $exists: false } },
        { grupo: null },
        { grupo: "" }
      ]
    });

    const groups = [...new Set(matches.map(m => m.grupo))].sort();
    const participantStats = [];

    groups.forEach(gid => {
      const gMatches = matches.filter(m => m.grupo === gid);
      const stats = {};

      gMatches.forEach(m => {
        [1, 2].forEach(num => {
          const pData = isDoubles ? m[`pareja${num}`] : m[`jugador${num}`];
          const pId = isDoubles 
            ? (pData?.map(p => p._id || p).sort().join('-'))
            : (pData?._id || pData);
          
          if (!pId) return;

          if (!stats[pId]) {
            stats[pId] = { 
              id: pId, 
              originalData: pData, 
              pts: 0, 
              sf: 0, 
              sc: 0, 
              gf: 0, 
              gc: 0, 
              group: gid 
            };
          }
        });

        const p1Id = isDoubles 
          ? (m.pareja1?.map(p => p._id || p).sort().join('-'))
          : (m.jugador1?._id || m.jugador1);
        const p2Id = isDoubles 
          ? (m.pareja2?.map(p => p._id || p).sort().join('-'))
          : (m.jugador2?._id || m.jugador2);

        if (!p1Id || !p2Id) return;

        const p1Sets = m.resultado?.sets?.reduce((acc, s) => acc + (s.jugador1 > s.jugador2 ? 1 : 0), 0) || 0;
        const p2Sets = m.resultado?.sets?.reduce((acc, s) => acc + (s.jugador2 > s.jugador1 ? 1 : 0), 0) || 0;
        const p1Games = m.resultado?.sets?.reduce((acc, s) => acc + s.jugador1, 0) || 0;
        const p2Games = m.resultado?.sets?.reduce((acc, s) => acc + s.jugador2, 0) || 0;

        stats[p1Id].sf += p1Sets; stats[p1Id].sc += p2Sets;
        stats[p2Id].sf += p2Sets; stats[p2Id].sc += p1Sets;
        stats[p1Id].gf += p1Games; stats[p1Id].gc += p2Games;
        stats[p2Id].gf += p2Games; stats[p2Id].gc += p1Games;

        const winnerId = m.resultado?.ganador?._id || m.resultado?.ganador;
        const p1IsWinner = isDoubles 
          ? m.pareja1?.some(p => (p._id || p) === winnerId?.toString())
          : p1Id?.toString() === winnerId?.toString();

        if (p1IsWinner) stats[p1Id].pts += 3;
        else stats[p2Id].pts += 3;
      });

      const sorted = Object.values(stats).sort((a, b) => 
        b.pts - a.pts || (b.sf - b.sc) - (a.sf - a.sc) || (b.gf - b.gc) - (a.gf - a.gc)
      );

      sorted.forEach((s, idx) => {
        participantStats.push({ ...s, rank: idx + 1 });
      });
    });

    let mainBracketParticipants = [];
    let losersBracketParticipants = [];

    if (['eliminacion_directa_perdedores', 'grupos_1y2_eliminacion'].includes(tournament.formato)) {
      // Clasificación: Los 2 primeros de cada zona van al Cuadro Principal.
      mainBracketParticipants = participantStats.filter(ps => ps.rank <= 2);
      if (tournament.formato === 'eliminacion_directa_perdedores') {
        // El resto (3ro, 4to, etc.) van al Cuadro de Perdedores.
        losersBracketParticipants = participantStats.filter(ps => ps.rank > 2);
      }
    } else {
      // Comportamiento anterior para otros formatos que usen grupos
      mainBracketParticipants = participantStats;
    }

    const mainParticipants = mainBracketParticipants;
    const losersParticipants = losersBracketParticipants;

    // Lógica de Sembrado Personalizado para el Cuadro Principal (8 jugadores)
    let mainList = [];
    if (tournament.formato === 'eliminacion_directa_perdedores' && mainParticipants.length === 8) {
      const zoneNames = tournament.zonas.map(z => z.nombre);
      const getP = (zoneIdx, rank) => mainParticipants.find(p => p.group === zoneNames[zoneIdx] && p.rank === rank);

      mainList = [
        getP(0, 1), getP(1, 1), getP(2, 1), getP(3, 1), 
        getP(1, 2), getP(0, 2), getP(3, 2), getP(2, 2)
      ].filter(p => p);
    } else if (tournament.formato === 'grupos_1y2_eliminacion') {
      const zoneNames = tournament.zonas.map(z => z.nombre);
      const getP = (zoneIdx, rank) => mainParticipants.find(p => p.group === zoneNames[zoneIdx] && p.rank === rank);
      
      const numZones = tournament.zonas.length;
      const firsts = [];
      const seconds = [];
      for (let i = 0; i < numZones; i++) {
        const p1 = getP(i, 1);
        if (p1) firsts.push(p1);
        const p2 = getP(i, 2);
        if (p2) seconds.push(p2);
      }
      mainList = [...firsts, ...seconds];
    } else {
      mainList = mainParticipants;
    }

    // Lógica de Sembrado Personalizado para el Cuadro de Perdedores (8 jugadores)
    let losersList = [];
    if (tournament.formato === 'eliminacion_directa_perdedores' && losersParticipants.length === 8) {
      const zoneNames = tournament.zonas.map(z => z.nombre);
      const getP = (zoneIdx, rank) => losersParticipants.find(p => p.group === zoneNames[zoneIdx] && p.rank === rank);

      losersList = [
        getP(0, 3), getP(1, 3), getP(2, 3), getP(3, 3), 
        getP(1, 4), getP(0, 4), getP(3, 4), getP(2, 4)
      ].filter(p => p);
    } else {
      losersList = losersParticipants;
    }

    const mapToBracket = (ps) => {
      if (isDoubles) {
        return { jugador1: ps.originalData[0], jugador2: ps.originalData[1] };
      } else {
        return { jugador1: ps.id };
      }
    };

    const finalMainList = mainList.map(mapToBracket);
    const finalLosersList = losersList.map(mapToBracket);

    tournament.bracket = await bracketService.generateSingleElimination(tournament._id, finalMainList, isDoubles, 'principal');
    
    // Award qualifying points based on bracket starting round
    if (tournament.bracket?.rounds) {
      const playerIds = [];
      mainList.forEach(ps => {
        if (isDoubles) {
          const players = Array.isArray(ps.originalData) ? ps.originalData : [ps.originalData];
          players.forEach(pl => {
            if (pl) {
              const pId = pl._id || pl;
              if (pId) playerIds.push(pId);
            }
          });
        } else {
          if (ps.id) playerIds.push(ps.id);
        }
      });
      await statsService.awardQualifyingPoints(tournament, playerIds, tournament.bracket.rounds);
    }
    
    if (tournament.formato === 'eliminacion_directa_perdedores' && finalLosersList.length >= 2) {
      tournament.bracketSecundario = await bracketService.generateSingleElimination(tournament._id, finalLosersList, isDoubles, 'perdedores');
    }

    await tournament.save();
    res.status(200).json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

exports.removeInscription = async (req, res, next) => {
  try {
    const { inscriptionId } = req.body;
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

    tournament.inscripciones = tournament.inscripciones.filter(
      i => i._id.toString() !== inscriptionId
    );

    await tournament.save();
    res.status(200).json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

exports.addPartner = async (req, res, next) => {
  try {
    const { inscriptionId, jugador2Id } = req.body;
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

    const inscription = tournament.inscripciones.id(inscriptionId);
    if (!inscription) return res.status(404).json({ success: false, message: 'Inscription not found' });

    inscription.jugador2 = jugador2Id;
    await tournament.save();
    
    res.status(200).json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

exports.updateZones = async (req, res, next) => {
  try {
    const { zonas } = req.body;
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: 'Torneo no encontrado' });

    tournament.zonas = zonas;
    await tournament.save();
    res.status(200).json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

exports.regenerateGroupMatches = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: 'Torneo no encontrado' });

    if (tournament.estado !== 'en_curso') {
      return res.status(400).json({ success: false, message: 'El torneo debe estar en curso para regenerar partidos' });
    }

    if (!tournament.zonas || tournament.zonas.length === 0) {
      return res.status(400).json({ success: false, message: 'El torneo no tiene zonas configuradas' });
    }

    const Match = require('../models/Match');
    const isDoubles = tournament.disciplina === 'padel';

    // Delete only group-stage matches (those with a 'grupo' field)
    await Match.deleteMany({ torneoId: tournament._id, grupo: { $exists: true, $ne: null, $ne: '' } });

    let created = 0;
    for (const zona of tournament.zonas) {
      const participants = zona.jugadores;
      const n = participants.length;
      if (n < 2) continue;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          await Match.create({
            torneoId: tournament._id,
            ronda: 1,
            numeroPartido: tournament.zonas.indexOf(zona) * 100 + (i * 10 + j),
            grupo: zona.nombre,
            estado: 'pendiente',
            jugador1: isDoubles ? undefined : participants[i],
            jugador2: isDoubles ? undefined : participants[j],
            pareja1: isDoubles ? [participants[i]] : undefined,
            pareja2: isDoubles ? [participants[j]] : undefined
          });
          created++;
        }
      }
    }

    res.status(200).json({ success: true, message: `Se generaron ${created} partidos de grupo`, data: tournament });
  } catch (error) {
    next(error);
  }
};

exports.updateTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: 'Torneo no encontrado' });

    if (tournament.organizadorId.toString() !== req.user.id && req.user.rol !== 'administrador') {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const allowedFields = [
      'nombre', 'descripcion', 'disciplina', 'formato', 
      'maxJugadores', 'minJugadores', 'fechaInicio', 
      'fechaLimiteInscripcion', 'categoria', 'premio', 'puntosConfig'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        tournament[field] = req.body[field];
      }
    });

    await tournament.save();
    res.status(200).json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};
