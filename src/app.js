import { loadDashboardData } from "./dataService.js";

const state = {
  data: null,
  filter: "all",
};

const formatPct = (value) => `${(value * 100).toFixed(1)}%`;

const signalFor = (player) => {
  const lastTwo = player.lastFive.slice(0, 2);
  const drops = lastTwo.map((game) => (player.seasonFg - game.fg) / player.seasonFg);
  const bothBelowEight = drops.every((drop) => drop >= 0.08);
  const bothBelowTen = drops.every((drop) => drop >= 0.1);

  if (bothBelowTen) return { label: "Heavy dip", level: "severe" };
  if (bothBelowEight) return { label: "8%+ watch", level: "watch" };
  if (drops.every((drop) => drop <= -0.04)) return { label: "Heating", level: "hot" };
  return { label: "Neutral", level: "neutral" };
};

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

const renderNbaPlayers = (players) => {
  const tbody = document.querySelector("#nbaPlayers");
  const rows = players
    .map((player) => ({ player, signal: signalFor(player) }))
    .filter(({ signal }) => state.filter === "all" || signal.level === "watch" || signal.level === "severe");

  tbody.innerHTML = rows
    .map(({ player, signal }) => {
      const lastTwo = player.lastFive.slice(0, 2).map((game) => formatPct(game.fg)).join(" / ");
      return `
        <tr class="${signal.level === "watch" || signal.level === "severe" ? "flagged" : ""}">
          <td>
            <span class="player-name">
              ${player.name}
              <small>${player.position}</small>
            </span>
          </td>
          <td>${player.team}</td>
          <td>${player.ppg.toFixed(1)}</td>
          <td>${formatPct(player.seasonFg)}</td>
          <td>${lastTwo}</td>
          <td>${renderSpark(player.lastFive)}</td>
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
            <h3>${game.away.name} @ ${game.home.name}</h3>
            <small>${game.status}</small>
          </header>
          ${[game.away, game.home]
            .map(
              (team) => `
                <div class="team-row">
                  <strong>${team.name}</strong>
                  <span class="hit-total">
                    <strong>${team.previousTwoGameHits.reduce((sum, value) => sum + value, 0)}</strong>
                    <small>${team.previousTwoGameHits.join(" + ")} hits</small>
                  </span>
                </div>
              `,
            )
            .join("")}
        </article>
      `,
    )
    .join("");
};

const renderMetrics = (data) => {
  const flagged = data.nba.players.filter((player) => {
    const signal = signalFor(player);
    return signal.level === "watch" || signal.level === "severe";
  }).length;

  document.querySelector("#nbaFlagCount").textContent = flagged;
  document.querySelector("#mlbGameCount").textContent = data.mlb.games.length;
  document.querySelector("#dataMode").textContent = data.mode;
  document.querySelector("#nbaGameCount").textContent = `${data.nba.games.length} games`;
};

const render = () => {
  renderMetrics(state.data);
  renderNbaGames(state.data.nba.games);
  renderNbaPlayers(state.data.nba.players);
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
