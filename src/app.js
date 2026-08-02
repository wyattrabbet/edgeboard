import { loadDashboardData } from "./dataService.js";

const state = {
  data: null,
  filter: "all",
};

const formatPct = (value) => `${(value * 100).toFixed(1)}%`;
const formatPoints = (games) => games.map((game) => game.points).join(" / ");
const nextLabel = (nextOpponent) => nextOpponent || "TBD";
const pitcherLabel = (pitcher) => pitcher || "TBD";
const recordLabel = (record) => record || "TBD";
const hitValue = (game) => (typeof game === "number" ? game : game?.hits);
const hitLabel = (game, fallback) => (typeof game === "number" ? fallback : game?.date || fallback);
const hitTotal = (hits) => (hits?.length ? hits.reduce((sum, game) => sum + hitValue(game), 0) : "—");
const hitDetail = (hits) => (hits?.length ? `2G total ${hitTotal(hits)}` : "hit feed pending");
const hitGameValue = (hits, index) => (hits?.length ? hitValue(hits[index]) : "—");
const previousGameHits = (hits) => (hits?.length ? hitValue(hits[0]) : null);
const hitMeta = (game) => {
  if (!game || typeof game === "number") return "";
  return [game.opponent, game.score].filter(Boolean).join(" · ");
};

const renderHitGame = (hits, index, fallback) => {
  const game = hits?.[index];
  const meta = hitMeta(game);

  return `
    <span class="hit-game">
      <small>${hitLabel(game, fallback)}</small>
      <strong>${hitGameValue(hits, index)}</strong>
      ${meta ? `<em>${meta}</em>` : ""}
    </span>
  `;
};

const hitSignal = (hits) => {
  if (!hits?.length) return { label: "Pending", level: "neutral" };
  const total = hitTotal(hits);
  if (total >= 20) return { label: "High form", level: "hot" };
  if (total <= 10) return { label: "Cold bats", level: "severe" };
  return { label: "No flag", level: "neutral" };
};

const signalFor = (player) => {
  const lastTwo = player.lastFive.slice(0, 2);
  const drops = lastTwo.map((game) => player.seasonFg - game.fg);
  const bothBelowEight = drops.every((drop) => drop >= 0.08);
  const bothBelowTen = drops.every((drop) => drop >= 0.1);

  if (bothBelowTen) return { label: "10+ pt dip", level: "severe" };
  if (bothBelowEight) return { label: "8-10 pt dip", level: "watch" };
  if (drops.every((drop) => drop <= -0.04)) return { label: "Heating", level: "hot" };
  return { label: "Neutral", level: "neutral" };
};

const recordPct = (record) => {
  const [wins, losses] = String(record ?? "")
    .split("-")
    .map((value) => Number(value));
  if (!Number.isFinite(wins) || !Number.isFinite(losses) || wins + losses === 0) return null;
  return wins / (wins + losses);
};

const addAlert = (alerts, alert) => {
  alerts.push({
    level: "watch",
    sport: "MLB",
    ...alert,
  });
};

const buildMlbAlerts = (games) => {
  const alerts = [];

  games.forEach((game) => {
    const awayLastGameHits = previousGameHits(game.away.previousTwoGameHits);
    const homeLastGameHits = previousGameHits(game.home.previousTwoGameHits);
    const awayPct = recordPct(game.away.record);
    const homePct = recordPct(game.home.record);
    const matchup = `${game.away.name} @ ${game.home.name}`;
    const pitchers = `${pitcherLabel(game.away.startingPitcher)} vs ${pitcherLabel(game.home.startingPitcher)}`;

    if (awayLastGameHits !== null && homeLastGameHits !== null && awayLastGameHits <= 5 && homeLastGameHits <= 5) {
      addAlert(alerts, {
        level: "hot",
        matchup,
        market: "Game total over",
        condition: `If both teams had 5 hits or fewer in their prior game (${game.away.name}: ${awayLastGameHits}, ${game.home.name}: ${homeLastGameHits})`,
        angle: "Then alert to review betting the game over.",
        detail: `Pitchers: ${pitchers}`,
      });
    }

    if (awayLastGameHits !== null && homeLastGameHits !== null && awayLastGameHits >= 8 && homeLastGameHits >= 8) {
      addAlert(alerts, {
        level: "severe",
        matchup,
        market: "Game total under",
        condition: `If both teams had 8 hits or more in their prior game (${game.away.name}: ${awayLastGameHits}, ${game.home.name}: ${homeLastGameHits})`,
        angle: "Then alert to review betting the game under.",
        detail: `Pitchers: ${pitchers}`,
      });
    }

    if (awayPct !== null && homePct !== null && Math.abs(awayPct - homePct) >= 0.08) {
      const edgeTeam = awayPct > homePct ? game.away : game.home;
      const fadeTeam = awayPct > homePct ? game.home : game.away;
      addAlert(alerts, {
        matchup,
        market: `${edgeTeam.name} moneyline`,
        condition: `If the record gap is 8+ percentage points (${edgeTeam.record} vs ${fadeTeam.record})`,
        angle: `Then flag ${edgeTeam.name} moneyline pricing against the pitcher matchup: ${pitchers}.`,
      });
    }
  });

  return alerts;
};

const buildNbaAlerts = (players) =>
  players
    .map((player) => ({ player, signal: signalFor(player) }))
    .filter(({ signal }) => signal.level === "watch" || signal.level === "severe")
    .slice(0, 8)
    .map(({ player, signal }) => ({
      level: signal.level,
      sport: "NBA",
      matchup: `${player.name} ${nextLabel(player.nextOpponent)}`,
      market: "Player points",
      condition: `If a top scorer is 8+ points below season FG% for two straight games`,
      angle: `Then flag ${player.name} points props for review before tip.`,
    }));

const buildBetAlerts = (data) => [...buildMlbAlerts(data.mlb.games), ...buildNbaAlerts(data.nba.players)];

const renderOdds = (game) => {
  if (!game.odds?.length) return `<div class="odds-row"><span>No odds posted</span></div>`;
  return game.odds
    .map(
      (book) => `
        <div class="odds-row">
          <span class="book">${book.book}</span>
          <span>${book.away} ${book.awayPrice} · ${book.home} ${book.homePrice}</span>
        </div>
      `,
    )
    .join("");
};

const renderBetAlerts = (alerts) => {
  const container = document.querySelector("#betAlerts");
  if (!alerts.length) {
    container.innerHTML = `<div class="empty-state">No bet alerts on the current slate.</div>`;
    return;
  }

  container.innerHTML = alerts
    .slice(0, 12)
    .map(
      (alert) => `
        <article class="alert-card ${alert.level}">
          <div>
            <span class="alert-sport">${alert.sport}</span>
            <h4>${alert.market}</h4>
            <strong>${alert.matchup}</strong>
          </div>
          <p>${alert.condition}</p>
          <small>${alert.angle}</small>
          ${alert.detail ? `<small>${alert.detail}</small>` : ""}
        </article>
      `,
    )
    .join("");
};

const renderNbaGames = (games) => {
  const container = document.querySelector("#nbaGames");
  container.innerHTML = games
    .map(
      (game) => `
        <article class="game-card">
          <header>
            <strong>${game.away} @ ${game.home}</strong>
            <small>${game.status}</small>
          </header>
          ${renderOdds(game)}
        </article>
      `,
    )
    .join("");
};

const renderSpark = (games) => {
  const maxPoints = Math.max(...games.map((game) => game.points), 1);
  return `
    <div class="spark" title="${games.map((game) => `${game.points} pts, ${formatPct(game.fg)}`).join(" | ")}">
      ${games
        .map((game) => `<span style="height:${Math.max(5, (game.points / maxPoints) * 38)}px"></span>`)
        .join("")}
    </div>
  `;
};

const renderPointStack = (games) => `
  <div class="point-stack">
    <strong>${formatPoints(games)}</strong>
    <small>${games.map((game) => formatPct(game.fg)).join(" / ")} FG</small>
  </div>
`;

const renderLastFive = (games) => `
  <div class="last-five">
    ${renderSpark(games)}
    <span class="point-list">${formatPoints(games)}</span>
  </div>
`;

const renderNbaPlayers = (players) => {
  const tbody = document.querySelector("#nbaPlayers");
  const rows = players
    .map((player) => ({ player, signal: signalFor(player) }))
    .filter(({ signal }) => state.filter === "all" || signal.level === "watch" || signal.level === "severe");

  tbody.innerHTML = rows
    .map(({ player, signal }) => {
      const lastTwo = player.lastFive.slice(0, 2);
      return `
        <tr class="${signal.level === "watch" || signal.level === "severe" ? "flagged" : ""}">
          <td>
            <span class="player-name">
              ${player.name}
              <small>${player.position}</small>
            </span>
          </td>
          <td>${player.team}</td>
          <td><span class="next-matchup">${nextLabel(player.nextOpponent)}</span></td>
          <td>${player.ppg.toFixed(1)}</td>
          <td>${formatPct(player.seasonFg)}</td>
          <td>${renderPointStack(lastTwo)}</td>
          <td>${renderLastFive(player.lastFive)}</td>
          <td><span class="pill ${signal.level}">${signal.label}</span></td>
        </tr>
      `;
    })
    .join("");
};

const renderMlbGames = (games) => {
  const container = document.querySelector("#mlbGames");
  container.innerHTML = games
    .map(
      (game) => `
        <article class="mlb-card">
          <header>
            <div>
              <h3>${game.away.name} @ ${game.home.name}</h3>
              <small>${game.status}</small>
            </div>
            <span class="market-tag">HITS</span>
          </header>
          ${[game.away, game.home]
            .map((team) => {
              const signal = hitSignal(team.previousTwoGameHits);
              return `
                <div class="team-row">
                  <span class="team-context">
                    <strong>${team.name}</strong>
                    <small>Next: ${nextLabel(team.nextOpponent)}</small>
                    <small class="pitcher-line">Pitcher: ${pitcherLabel(team.startingPitcher)}</small>
                    <small class="record-line">Record: ${recordLabel(team.record)}</small>
                  </span>
                  <span class="hit-total">
                    <span class="hit-games">
                      ${renderHitGame(team.previousTwoGameHits, 0, "G-1")}
                      ${renderHitGame(team.previousTwoGameHits, 1, "G-2")}
                    </span>
                    <small>${hitDetail(team.previousTwoGameHits)}</small>
                  </span>
                  <span class="pill ${signal.level}">${signal.label}</span>
                </div>
              `;
            })
            .join("")}
        </article>
      `,
    )
    .join("");
};

const renderMlbSlate = (games) => {
  const container = document.querySelector("#mlbSlate");
  container.innerHTML = [
    `
      <button class="slate-chip active" type="button">
        <strong>All games</strong>
        <span>${games.length} matchups</span>
      </button>
    `,
    ...games.map(
      (game) => `
        <button class="slate-chip" type="button">
          <strong>${game.away.name} @ ${game.home.name}</strong>
          <span>${game.status}</span>
        </button>
      `,
    ),
  ].join("");
};

const renderMetrics = (data) => {
  const alerts = buildBetAlerts(data);
  const flagged = data.nba.players.filter((player) => {
    const signal = signalFor(player);
    return signal.level === "watch" || signal.level === "severe";
  }).length;

  document.querySelector("#nbaFlagCount").textContent = flagged;
  document.querySelector("#betAlertCount").textContent = alerts.length;
  document.querySelector("#mlbGameCount").textContent = data.mlb.games.length;
  document.querySelector("#dataMode").textContent = data.mode;
  document.querySelector("#nbaGameCount").textContent = `${data.nba.games.length} games`;
  renderBetAlerts(alerts);
};

const render = () => {
  renderMetrics(state.data);
  renderNbaGames(state.data.nba.games);
  renderNbaPlayers(state.data.nba.players);
  renderMlbSlate(state.data.mlb.games);
  renderMlbGames(state.data.mlb.games);
};

const refresh = async () => {
  const apiKey = document.querySelector("#oddsApiKey").value.trim();
  document.querySelector("#refreshButton").disabled = true;
  state.data = await loadDashboardData({ oddsApiKey });
  render();
  document.querySelector("#refreshButton").disabled = false;
};

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".sport-view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.tab}`).classList.add("active");
  });
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((filter) => filter.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    renderNbaPlayers(state.data.nba.players);
  });
});

document.querySelector("#refreshButton").addEventListener("click", refresh);

refresh();
