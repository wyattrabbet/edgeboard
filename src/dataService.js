import { sampleDashboardData } from "./sampleData.js";

const ODDS_BASE = "https://api.the-odds-api.com/v4/sports";
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const MLB_BASE = "https://statsapi.mlb.com/api/v1";

const toEspnGame = (event) => {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const homeTeam = competitors.find((team) => team.homeAway === "home")?.team;
  const awayTeam = competitors.find((team) => team.homeAway === "away")?.team;

  return {
    id: event.id,
    home: homeTeam?.abbreviation ?? "HOME",
    away: awayTeam?.abbreviation ?? "AWAY",
    homeFull: homeTeam?.displayName ?? homeTeam?.name ?? "Home",
    awayFull: awayTeam?.displayName ?? awayTeam?.name ?? "Away",
    status: event.status?.type?.shortDetail ?? event.status?.type?.description ?? "Scheduled",
    odds: [],
  };
};

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
};

const mergeOdds = (games, oddsEvents) => {
  const normalized = new Map(
    oddsEvents.map((event) => [`${event.away_team}|${event.home_team}`.toLowerCase(), event]),
  );

  return games.map((game) => {
    const odds = normalized.get(`${game.awayFull}|${game.homeFull}`.toLowerCase());
    if (!odds) return game;

    return {
      ...game,
      odds: odds.bookmakers
        .filter((book) => book.key === "draftkings" || book.key === "fanduel")
        .map((book) => {
          const market = book.markets.find((entry) => entry.key === "h2h");
          const away = market?.outcomes.find((outcome) => outcome.name === odds.away_team);
          const home = market?.outcomes.find((outcome) => outcome.name === odds.home_team);
          return {
            book: book.title,
            away: game.away,
            home: game.home,
            awayPrice: away?.price ?? "—",
            homePrice: home?.price ?? "—",
          };
        }),
    };
  });
};

const loadEspnScoreboard = async (sportPath) => {
  const data = await fetchJson(`${ESPN_BASE}/${sportPath}/scoreboard`);
  return (data.events ?? []).map(toEspnGame);
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatShortDate = (date) => `${date.getMonth() + 1}/${date.getDate()}`;

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toMlbStatus = (game) => {
  const status = game.status?.detailedState ?? game.status?.abstractGameState ?? "Scheduled";
  const gameDate = new Date(game.gameDate);

  if (Number.isNaN(gameDate.getTime()) || status !== "Scheduled") return status;
  return gameDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
};

const teamHitsFromGame = (game, teamId) => {
  const side = game.teams?.away?.team?.id === teamId ? "away" : "home";
  return game.linescore?.teams?.[side]?.hits ?? null;
};

const probablePitcherName = (game, side) => game.teams?.[side]?.probablePitcher?.fullName ?? "TBD";

const teamRecord = (game, side) => {
  const record = game.teams?.[side]?.leagueRecord;
  if (!record) return "TBD";
  if (record.wins !== undefined && record.losses !== undefined) return `${record.wins}-${record.losses}`;
  return record.summary ?? "TBD";
};

const toScore = (value) => {
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
};

const previousGameContext = (game, teamId) => {
  const side = game.teams?.away?.team?.id === teamId ? "away" : "home";
  const opponentSide = side === "away" ? "home" : "away";
  const team = game.teams?.[side];
  const opponent = game.teams?.[opponentSide];
  const teamScore = toScore(team?.score);
  const opponentScore = toScore(opponent?.score);
  const outcome = teamScore === null || opponentScore === null ? "" : teamScore > opponentScore ? "W" : "L";

  return {
    date: formatShortDate(new Date(game.gameDate)),
    hits: teamHitsFromGame(game, teamId),
    opponent: `${side === "away" ? "@" : "vs"} ${opponent?.team?.name ?? "Opponent"}`,
    score: teamScore === null || opponentScore === null ? "Final" : `${outcome} ${teamScore}-${opponentScore}`,
  };
};

const loadMlbSchedule = async (date = new Date()) => {
  const params = new URLSearchParams({
    sportId: "1",
    date: formatDate(date),
    hydrate: "linescore,probablePitcher",
  });
  const data = await fetchJson(`${MLB_BASE}/schedule?${params.toString()}`);
  return (data.dates ?? []).flatMap((day) => day.games ?? []);
};

const loadMlbPreviousHits = async (teamId, beforeDate) => {
  const params = new URLSearchParams({
    sportId: "1",
    teamId: String(teamId),
    startDate: formatDate(addDays(beforeDate, -45)),
    endDate: formatDate(addDays(beforeDate, -1)),
    hydrate: "linescore",
  });
  const data = await fetchJson(`${MLB_BASE}/schedule?${params.toString()}`);
  const completedGames = (data.dates ?? [])
    .flatMap((day) => day.games ?? [])
    .filter((game) => game.status?.abstractGameState === "Final")
    .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));

  return completedGames
    .map((game) => previousGameContext(game, teamId))
    .filter((game) => Number.isFinite(game.hits))
    .slice(0, 2);
};

const loadMlbStatsSlate = async (date = new Date()) => {
  const games = await loadMlbSchedule(date);
  const hitCache = new Map();

  const getHits = async (teamId) => {
    if (!hitCache.has(teamId)) hitCache.set(teamId, loadMlbPreviousHits(teamId, date));
    return hitCache.get(teamId);
  };

  return Promise.all(
    games.map(async (game) => {
      const awayTeam = game.teams.away.team;
      const homeTeam = game.teams.home.team;
      const [awayHits, homeHits] = await Promise.all([getHits(awayTeam.id), getHits(homeTeam.id)]);

      return {
        id: String(game.gamePk),
        status: toMlbStatus(game),
        away: {
          name: awayTeam.name,
          nextOpponent: `@ ${homeTeam.name}`,
          record: teamRecord(game, "away"),
          startingPitcher: probablePitcherName(game, "away"),
          previousTwoGameHits: awayHits.length === 2 ? awayHits : null,
        },
        home: {
          name: homeTeam.name,
          nextOpponent: `vs ${awayTeam.name}`,
          record: teamRecord(game, "home"),
          startingPitcher: probablePitcherName(game, "home"),
          previousTwoGameHits: homeHits.length === 2 ? homeHits : null,
        },
      };
    }),
  );
};

const buildNextOpponentMap = (games) => {
  const map = new Map();

  games.forEach((game) => {
    if (!map.has(game.away)) map.set(game.away, `@ ${game.home}`);
    if (!map.has(game.home)) map.set(game.home, `vs ${game.away}`);
    if (game.awayFull && !map.has(game.awayFull)) map.set(game.awayFull, `@ ${game.homeFull}`);
    if (game.homeFull && !map.has(game.homeFull)) map.set(game.homeFull, `vs ${game.awayFull}`);
  });

  return map;
};

const applyNbaNextOpponents = (players, games) => {
  const opponents = buildNextOpponentMap(games);
  return players.map((player) => ({
    ...player,
    nextOpponent: opponents.get(player.team) ?? player.nextOpponent,
  }));
};

const loadOdds = async (sportKey, apiKey) => {
  if (!apiKey) return [];

  const params = new URLSearchParams({
    apiKey,
    regions: "us",
    markets: "h2h,spreads,totals",
    oddsFormat: "american",
    bookmakers: "draftkings,fanduel",
  });

  return fetchJson(`${ODDS_BASE}/${sportKey}/odds/?${params.toString()}`);
};

export const loadDashboardData = async ({ oddsApiKey }) => {
  const data = structuredClone(sampleDashboardData);

  const [nbaGamesResult, mlbGamesResult, nbaOddsResult, mlbOddsResult] = await Promise.allSettled([
    loadEspnScoreboard("basketball/nba"),
    loadMlbStatsSlate(),
    loadOdds("basketball_nba", oddsApiKey),
    loadOdds("baseball_mlb", oddsApiKey),
  ]);

  try {
    const nbaGames = nbaGamesResult.status === "fulfilled" ? nbaGamesResult.value : [];
    const mlbGames = mlbGamesResult.status === "fulfilled" ? mlbGamesResult.value : [];
    const nbaOdds = nbaOddsResult.status === "fulfilled" ? nbaOddsResult.value : [];
    const mlbOdds = mlbOddsResult.status === "fulfilled" ? mlbOddsResult.value : [];
    if (nbaGames.length) data.nba.games = mergeOdds(nbaGames, nbaOdds);
    if (nbaGames.length) data.nba.players = applyNbaNextOpponents(data.nba.players, nbaGames);
    if (mlbGames.length) {
      data.mlb.games = mlbGames;
    }
    if (mlbOdds.length) data.mlb.odds = mlbOdds;
    if (nbaOdds.length || mlbOdds.length) data.mode = "Live odds";
    else if (mlbGames.length) data.mode = "Live MLB stats";
    else if (nbaGames.length) data.mode = "Live schedule";
  } catch (error) {
    console.warn("Using sample dashboard data:", error);
    data.mode = "Sample";
  }

  return data;
};
