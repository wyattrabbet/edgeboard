import { sampleDashboardData } from "./sampleData.js";

const ODDS_BASE = "https://api.the-odds-api.com/v4/sports";
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

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

const applyMlbNextOpponents = (sampleGames, espnGames) => {
  if (!espnGames.length) return sampleGames;

  const opponents = buildNextOpponentMap(espnGames);
  return sampleGames.map((game) => ({
    ...game,
    away: {
      ...game.away,
      nextOpponent: opponents.get(game.away.name) ?? game.away.nextOpponent,
    },
    home: {
      ...game.home,
      nextOpponent: opponents.get(game.home.name) ?? game.home.nextOpponent,
    },
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
    loadEspnScoreboard("baseball/mlb"),
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
      data.mlb.games = applyMlbNextOpponents(data.mlb.games, mlbGames).map((sample, index) => ({
        ...sample,
        status: mlbGames[index]?.status ?? sample.status,
      }));
    }
    if (mlbOdds.length) data.mlb.odds = mlbOdds;
    if (nbaOdds.length || mlbOdds.length) data.mode = "Live odds";
    else if (nbaGames.length || mlbGames.length) data.mode = "Live schedule";
  } catch (error) {
    console.warn("Using sample dashboard data:", error);
    data.mode = "Sample";
  }

  return data;
};
