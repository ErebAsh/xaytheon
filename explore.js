// Explore by Topic — Graph + List View (FULLY WORKING)

(function () {
  const form = document.getElementById("explore-form");
  if (!form) return;

  const topicEl = document.getElementById("ex-base-topic");
  const langEl = document.getElementById("ex-language");
  const limitEl = document.getElementById("ex-limit");
  const statusEl = document.getElementById("ex-status");

  const svg = d3.select("#graph");
  const width = () => svg.node().clientWidth;
  const height = () => svg.node().clientHeight;

  // View toggle
  const graphView = document.getElementById("graph-view");
  const listView = document.getElementById("list-view");

  //Active view button 
  function setActive(btn) {
    document.querySelectorAll(".view-toggle .btn")
      .forEach(b => b.classList.remove("btn-primary"));
    btn.classList.add("btn-primary");
  }

  document.getElementById("view-graph-btn")?.addEventListener("click", () => {
    graphView.style.display = "block";
    listView.style.display = "none";
    setActive(document.getElementById("view-graph-btn"))
  });

  document.getElementById("view-list-btn")?.addEventListener("click", () => {
    graphView.style.display = "none";
    listView.style.display = "block";
    setActive(document.getElementById("view-list-btn"))
  });

  // Graph state
  let sim;
  const nodes = new Map();
  const links = [];
  const linkKeys = new Set();

  // Shared data
  const exploreData = {
    repos: []
  };

  function setStatus(msg, level = "info") {
    statusEl.textContent = msg;
    statusEl.style.color = level === "error" ? "#b91c1c" : "#111827";
  }

  function nodeColor(d) {
    return d.type === "topic" ? "#0ea5e9" : "#111827";
  }

  function addNode(id, data) {
    if (!nodes.has(id)) nodes.set(id, { id, ...data });
    return nodes.get(id);
  }

  function addLink(a, b) {
    const key = `${a}->${b}`;
    if (linkKeys.has(key)) return;
    linkKeys.add(key);
    links.push({ source: a, target: b });
  }

  async function ghJson(url) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json"
      }
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return res.json();
  }

  async function searchReposByTopic(topic, language, limit) {
    const parts = [`topic:${topic}`];
    if (language) parts.push(`language:${language}`);

    const q = encodeURIComponent(parts.join(" "));
    const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${limit}`;

    const data = await ghJson(url);
    exploreData.repos.push(...data.items);
    return data.items;
  }

  // ---------- LIST VIEW ----------
  function renderRepoList(repos) {
    const tbody = document.getElementById("repo-list");
    if (!tbody) return;

    tbody.innerHTML = "";

    repos.forEach(repo => {
      const tr = document.createElement("tr");

      const safeRepo = JSON.stringify({
        full_name: repo.full_name,
        language: repo.language,
        html_url: repo.html_url
      }).replace(/"/g, "&quot;");

      tr.innerHTML = `
        <td>
          <a href="${repo.html_url}" target="_blank" rel="noopener" onclick='window.trackRepoView && window.trackRepoView(${safeRepo})'>
            ${repo.full_name}
          </a>
        </td>
        <td>${repo.topics?.[0] || "—"}</td>
        <td>${repo.language || "—"}</td>
        <td align="right">${repo.stargazers_count}</td>
      `;

      tbody.appendChild(tr);
    });
  }

  // ---------- GRAPH ----------
  function renderGraph() {
    svg.selectAll("*").remove();

    const g = svg.append("g");
    svg.call(d3.zoom().on("zoom", e => g.attr("transform", e.transform)));

    const nodeArr = Array.from(nodes.values());

    const linkSel = g.append("g")
      .attr("stroke", "rgba(0,0,0,0.25)")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line");

    const nodeSel = g.append("g")
      .selectAll("circle")
      .data(nodeArr, d => d.id)
      .enter()
      .append("circle")
      .attr("r", d => (d.type === "topic" ? 8 : 6))
      .attr("fill", nodeColor)
      .attr("stroke", "#fff")
      .style("cursor", "pointer")
      .on("click", onNodeClick);

    nodeSel.append("title").text(d => d.label);

    sim = d3.forceSimulation(nodeArr)
      .force("charge", d3.forceManyBody().strength(d => d.type === "topic" ? -120 : -40))
      .force("link", d3.forceLink(links).id(d => d.id).distance(70))
      .force("center", d3.forceCenter(width() / 2, height() / 2))
      .force("collide", d3.forceCollide(d => d.type === "topic" ? 14 : 10))
      .on("tick", () => {
        linkSel
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);

        nodeSel
          .attr("cx", d => d.x)
          .attr("cy", d => d.y);
      });
  }

  async function onNodeClick(event, d) {
    if (d.type === "repo") {
      if (window.trackRepoView) {
        window.trackRepoView({ full_name: d.label, html_url: d.url });
      }
      window.open(d.url, "_blank");
      return;
    }

    try {
      setStatus(`Expanding ${d.label}…`);
      const repos = await searchReposByTopic(d.label, langEl.value.trim(), 30);

      repos.forEach(r => {
        const repoId = `repo:${r.full_name}`;
        addNode(repoId, { type: "repo", label: r.full_name, url: r.html_url });
        addLink(repoId, d.id);
      });

      renderGraph();
      renderRepoList(exploreData.repos);
      setStatus(`Added ${repos.length} repos`);
    } catch (e) {
      setStatus("Failed to expand topic", "error");
    }
  }

  async function explore() {
    nodes.clear();
    links.length = 0;
    linkKeys.clear();
    exploreData.repos = [];

    const base = topicEl.value.trim() || "threejs";
    const lang = langEl.value.trim();
    const limit = Math.min(100, Math.max(10, Number(limitEl.value)));

    addNode(`topic:${base}`, { type: "topic", label: base });

    try {
      if (window.trackSearchInterest) {
        window.trackSearchInterest(base, lang);
      }
      setStatus("Loading repositories…");
      const repos = await searchReposByTopic(base, lang, limit);

      repos.forEach(r => {
        const repoId = `repo:${r.full_name}`;
        addNode(repoId, { type: "repo", label: r.full_name, url: r.html_url });
        addLink(repoId, `topic:${base}`);
      });

      renderGraph();
      renderRepoList(exploreData.repos);
      setStatus(`Loaded ${repos.length} repositories`);
    } catch (e) {
      setStatus("Failed to load data", "error");
    }
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    explore();
  });

  document.getElementById("ex-clear").addEventListener("click", () => {
    topicEl.value = "threejs";
    langEl.value = "";
    limitEl.value = "50";
    explore();
  });

  explore();
})();
