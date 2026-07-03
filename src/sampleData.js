const nbaPlayers = [
  ["Shai Gilgeous-Alexander", "OKC", "G", 31.8, 0.519, "@ DAL", [[26, 0.461], [24, 0.468], [36, 0.548], [29, 0.506], [34, 0.522]]],
  ["Luka Doncic", "LAL", "G", 30.6, 0.481, "@ GSW", [[25, 0.431], [28, 0.438], [41, 0.512], [33, 0.493], [37, 0.501]]],
  ["Giannis Antetokounmpo", "MIL", "F", 29.7, 0.604, "vs CLE", [[31, 0.593], [36, 0.611], [27, 0.571], [42, 0.652], [33, 0.621]]],
  ["Jayson Tatum", "BOS", "F", 27.1, 0.466, "@ NYK", [[21, 0.411], [23, 0.418], [35, 0.487], [29, 0.473], [31, 0.492]]],
  ["Anthony Edwards", "MIN", "G", 26.9, 0.459, "vs DEN", [[34, 0.506], [28, 0.478], [22, 0.407], [31, 0.462], [27, 0.451]]],
  ["Nikola Jokic", "DEN", "C", 26.4, 0.579, "@ MIN", [[29, 0.583], [24, 0.571], [33, 0.621], [27, 0.548], [31, 0.589]]],
  ["Kevin Durant", "HOU", "F", 26.1, 0.523, "vs PHX", [[20, 0.463], [22, 0.469], [30, 0.535], [33, 0.556], [26, 0.511]]],
  ["Donovan Mitchell", "CLE", "G", 25.8, 0.452, "@ MIL", [[18, 0.398], [26, 0.413], [32, 0.471], [28, 0.463], [29, 0.482]]],
  ["Jalen Brunson", "NYK", "G", 25.6, 0.488, "vs BOS", [[33, 0.517], [30, 0.502], [25, 0.468], [29, 0.493], [21, 0.447]]],
  ["Devin Booker", "PHX", "G", 25.4, 0.475, "@ HOU", [[19, 0.421], [24, 0.429], [36, 0.514], [27, 0.482], [31, 0.497]]],
  ["Stephen Curry", "GSW", "G", 24.8, 0.449, "vs LAL", [[29, 0.463], [22, 0.431], [34, 0.488], [18, 0.391], [27, 0.456]]],
  ["Trae Young", "ATL", "G", 24.5, 0.431, "vs ORL", [[20, 0.386], [17, 0.379], [30, 0.452], [28, 0.444], [25, 0.427]]],
];

const expandPlayers = () => {
  const teams = ["DAL", "MIA", "ORL", "SAC", "MEM", "IND", "NOP", "CHI", "BKN", "TOR", "SAS", "CHA"];
  const names = [
    "Paolo Banchero",
    "Ja Morant",
    "Zion Williamson",
    "Tyrese Maxey",
    "Cade Cunningham",
    "Jaylen Brown",
    "Victor Wembanyama",
    "LaMelo Ball",
    "Bam Adebayo",
    "DeMar DeRozan",
    "Brandon Ingram",
    "Tyler Herro",
  ];

  return [
    ...nbaPlayers,
    ...names.map((name, index) => {
      const fg = 0.438 + index * 0.006;
      const dip = index % 4 === 0;
      return [
        name,
        teams[index],
        index % 3 === 0 ? "F" : "G",
        24.2 - index * 0.35,
        fg,
        index % 2 === 0 ? "vs ATL" : "@ MIA",
        [
          [22 + index, dip ? fg * 0.9 : fg * 1.03],
          [19 + index, dip ? fg * 0.91 : fg * 0.98],
          [27 + index, fg * 1.02],
          [25 + index, fg * 0.99],
          [30 - index / 2, fg * 1.04],
        ],
      ];
    }),
  ]
    .map(([name, team, position, ppg, seasonFg, nextOpponent, games]) => ({
      name,
      team,
      position,
      ppg,
      seasonFg,
      nextOpponent,
      lastFive: games.map(([points, fg]) => ({ points, fg })),
    }))
    .sort((a, b) => b.ppg - a.ppg);
};

export const sampleDashboardData = {
  mode: "Sample",
  nba: {
    games: [
      {
        id: "nba-1",
        away: "BOS",
        home: "NYK",
        status: "7:30 PM ET",
        odds: [
          { book: "DraftKings", away: "BOS", awayPrice: -118, home: "NYK", homePrice: +100 },
          { book: "FanDuel", away: "BOS", awayPrice: -112, home: "NYK", homePrice: -104 },
        ],
      },
      {
        id: "nba-2",
        away: "DEN",
        home: "MIN",
        status: "9:00 PM ET",
        odds: [
          { book: "DraftKings", away: "DEN", awayPrice: +106, home: "MIN", homePrice: -126 },
          { book: "FanDuel", away: "DEN", awayPrice: +110, home: "MIN", homePrice: -130 },
        ],
      },
      {
        id: "nba-3",
        away: "LAL",
        home: "GSW",
        status: "10:00 PM ET",
        odds: [
          { book: "DraftKings", away: "LAL", awayPrice: +124, home: "GSW", homePrice: -148 },
          { book: "FanDuel", away: "LAL", awayPrice: +120, home: "GSW", homePrice: -142 },
        ],
      },
    ],
    players: expandPlayers(),
  },
  mlb: {
    games: [
      {
        id: "mlb-1",
        status: "6:40 PM ET",
        away: { name: "Yankees", nextOpponent: "@ Red Sox", previousTwoGameHits: [9, 11] },
        home: { name: "Red Sox", nextOpponent: "vs Yankees", previousTwoGameHits: [7, 8] },
      },
      {
        id: "mlb-2",
        status: "7:10 PM ET",
        away: { name: "Dodgers", nextOpponent: "@ Giants", previousTwoGameHits: [13, 10] },
        home: { name: "Giants", nextOpponent: "vs Dodgers", previousTwoGameHits: [5, 6] },
      },
      {
        id: "mlb-3",
        status: "8:05 PM ET",
        away: { name: "Cubs", nextOpponent: "@ Cardinals", previousTwoGameHits: [8, 12] },
        home: { name: "Cardinals", nextOpponent: "vs Cubs", previousTwoGameHits: [10, 7] },
      },
      {
        id: "mlb-4",
        status: "9:38 PM ET",
        away: { name: "Astros", nextOpponent: "@ Mariners", previousTwoGameHits: [6, 9] },
        home: { name: "Mariners", nextOpponent: "vs Astros", previousTwoGameHits: [11, 10] },
      },
    ],
  },
};
