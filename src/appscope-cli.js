#!/usr/bin/env node

import { Command } from "commander";
import fetch from "node-fetch";
import open from "open";

// Simple article clustering based on title similarity
function clusterArticles(articles) {
  const clusters = [];
  const processed = new Set();

  for (const article of articles) {
    if (processed.has(article.id)) continue;

    const similar = articles.filter((other) => {
      if (other.id === article.id || processed.has(other.id)) return false;
      return titleSimilarity(article.title, other.title) > 0.3;
    });

    const cluster = {
      id: clusters.length,
      headline: extractMainTopic(article.title),
      articles: [article, ...similar],
    };

    clusters.push(cluster);
    [article, ...similar].forEach((a) => processed.add(a.id));
  }

  return clusters.sort((a, b) => b.articles.length - a.articles.length);
}

function titleSimilarity(title1, title2) {
  const words1 = new Set(title1.toLowerCase().split(/\W+/));
  const words2 = new Set(title2.toLowerCase().split(/\W+/));
  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

function extractMainTopic(title) {
  const words = title.split(/\W+/).filter((w) => w.length > 3);
  return words.slice(0, 3).join(" ");
}

async function fetchDailyDevFeed(limit = 20) {
  // Using multiple reliable sources for fresh content
  const sources = [
    "https://hacker-news.firebaseio.com/v0/newstories.json", // Fresh stories, not just top
    "https://hacker-news.firebaseio.com/v0/topstories.json",
  ];

  try {
    // Get fresh stories first, fall back to top stories
    let storyIds = [];
    for (const source of sources) {
      try {
        const response = await fetch(source);
        storyIds = await response.json();
        break; // Use first successful source
      } catch (err) {
        continue; // Try next source
      }
    }

    if (storyIds.length === 0) {
      throw new Error("No stories available");
    }

    // Randomize and get a mix of stories for variety
    const shuffled = storyIds.sort(() => 0.5 - Math.random());
    const selectedIds = shuffled.slice(0, limit);

    const stories = await Promise.all(
      selectedIds.map(async (id) => {
        try {
          const storyResponse = await fetch(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`
          );
          return await storyResponse.json();
        } catch (err) {
          return null;
        }
      })
    );

    return stories
      .filter((story) => story && story.title && story.url)
      .map((story) => ({
        id: story.id.toString(),
        title: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        createdAt: new Date(story.time * 1000).toISOString(),
        source: { name: "App Discovery" },
        tags: [],
      }));
  } catch (error) {
    console.error("Error fetching content:", error.message);
    return [];
  }
}

function getAppTypeIcon(url) {
  if (!url) return "🔗";
  if (url.includes("github.com") || url.includes("gitlab.com")) return "📦";
  if (url.includes("app.") || url.includes("demo.") || url.includes(".app"))
    return "📱";
  if (url.includes("tool") || url.includes("dev")) return "🛠️";
  return "🌐";
}

function displayDashboard(clusters, selectedCluster = 0, showHelp = false) {
  console.clear();

  // Header with improved branding and visual hierarchy
  console.log(
    "\n🚀 \x1b[1m\x1b[96mAppScope\x1b[0m \x1b[90m|\x1b[0m \x1b[1m\x1b[37mDiscover Apps, Tools & Projects\x1b[0m"
  );
  console.log("\x1b[90m" + "─".repeat(60) + "\x1b[0m");
  console.log(
    "\x1b[90m📱 Live apps • 🛠️  Dev tools • 📦 Open source • 🌐 Resources\x1b[0m"
  );

  // Status indicator
  const totalApps = clusters.reduce(
    (sum, cluster) => sum + cluster.articles.length,
    0
  );
  console.log(
    `\x1b[32m✨ Found ${clusters.length} categories with ${totalApps} apps/tools\x1b[0m`
  );
  console.log(
    "\x1b[90m" +
      new Date().toLocaleString() +
      " • Press \x1b[33m?\x1b[90m for help\x1b[0m\n"
  );

  if (showHelp) {
    console.log("\x1b[1m\x1b[93m📖 Quick Help:\x1b[0m");
    console.log("\x1b[90m• \x1b[33m↑↓\x1b[90m arrows to navigate categories");
    console.log(
      "\x1b[90m• \x1b[33mo\x1b[90m to open selected app/tool in browser"
    );
    console.log(
      "\x1b[90m• \x1b[33mr\x1b[90m to refresh and get latest content"
    );
    console.log("\x1b[90m• \x1b[33m?\x1b[90m to toggle this help");
    console.log("\x1b[90m• \x1b[33mq\x1b[90m to quit\x1b[0m\n");
  }

  // Categories list with better visual design
  console.log("\x1b[1m📂 App Categories:\x1b[0m");
  clusters.forEach((cluster, i) => {
    const isSelected = i === selectedCluster;
    const marker = isSelected ? "\x1b[33m▶\x1b[0m" : " ";
    const bgColor = isSelected ? "\x1b[44m" : "";
    const textColor = isSelected ? "\x1b[97m" : "\x1b[96m";
    const resetColor = "\x1b[0m";

    console.log(
      `${marker} ${bgColor}${textColor} ${cluster.headline} ${resetColor}`
    );
  });

  // Selected category details with app type indicators
  if (clusters[selectedCluster]) {
    const cluster = clusters[selectedCluster];
    console.log(`\n\x1b[1m🎯 Apps in "${cluster.headline}":\x1b[0m`);
    cluster.articles.forEach((article, i) => {
      const icon = getAppTypeIcon(article.url);
      const title = `\x1b[32m${article.title.slice(0, 70)}${
        article.title.length > 70 ? "..." : ""
      }\x1b[0m`;

      console.log(`  ${icon} ${title}`);
    });
  }

  // Enhanced controls with visual separation
  console.log("\n\x1b[90m" + "─".repeat(60) + "\x1b[0m");
  console.log(
    "\x1b[1m\x1b[93mControls:\x1b[0m \x1b[33m[↑↓]\x1b[0m Navigate \x1b[33m[o]\x1b[0m Open App \x1b[33m[r]\x1b[0m Refresh \x1b[33m[?]\x1b[0m Help \x1b[33m[q]\x1b[0m Quit"
  );

  if (
    clusters[selectedCluster] &&
    clusters[selectedCluster].articles.length > 0
  ) {
    const selectedApp = clusters[selectedCluster].articles[0];
    console.log(
      `\x1b[90mReady to open: ${selectedApp.title.slice(0, 50)}...\x1b[0m`
    );
  }
}

async function runInteractiveDashboard(clusters) {
  let selectedCluster = 0;
  let showHelp = false;

  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  displayDashboard(clusters, selectedCluster, showHelp);

  return new Promise((resolve) => {
    stdin.on("data", async (key) => {
      if (key === "\u0003" || key === "q") {
        // Ctrl+C or 'q'
        stdin.setRawMode(false);
        console.log(
          "\n\x1b[32m👋 Thanks for using AppScope! Happy coding!\x1b[0m\n"
        );
        resolve();
        return;
      }

      if (key === "?") {
        // Toggle help
        showHelp = !showHelp;
        displayDashboard(clusters, selectedCluster, showHelp);
      } else if (key === "\u001B[A" && selectedCluster > 0) {
        // Up arrow
        selectedCluster--;
        displayDashboard(clusters, selectedCluster, showHelp);
      } else if (key === "\u001B[B" && selectedCluster < clusters.length - 1) {
        // Down arrow
        selectedCluster++;
        displayDashboard(clusters, selectedCluster, showHelp);
      } else if (key === "o" && clusters[selectedCluster]) {
        // Open app/tool
        const app = clusters[selectedCluster].articles[0];
        const appType =
          getAppTypeIcon(app.url) === "📦"
            ? "repository"
            : getAppTypeIcon(app.url) === "📱"
            ? "live app"
            : getAppTypeIcon(app.url) === "🛠️"
            ? "development tool"
            : "resource";

        console.log(`\n\x1b[32m🚀 Opening ${appType}: ${app.title}\x1b[0m`);
        console.log(`\x1b[90m📍 ${app.url}\x1b[0m`);
        console.log(`\x1b[90m⏳ Loading in your browser...\x1b[0m`);

        await open(app.url);
        setTimeout(
          () => displayDashboard(clusters, selectedCluster, showHelp),
          2000
        );
      } else if (key === "r") {
        // Refresh
        console.log("\n\x1b[33m🔄 Refreshing app directory...\x1b[0m");
        console.log("\x1b[90m📡 Fetching latest apps and tools...\x1b[0m");

        const articles = await fetchDailyDevFeed();
        clusters = clusterArticles(articles);
        selectedCluster = 0;
        showHelp = false;

        console.log("\x1b[32m✅ Updated with latest content!\x1b[0m");
        setTimeout(
          () => displayDashboard(clusters, selectedCluster, showHelp),
          1000
        );
      }
    });
  });
}

const program = new Command();

program
  .name("appscope")
  .description(
    "🚀 Terminal directory for apps, tools & projects - Open real apps instantly!"
  )
  .version("1.0.0")
  .option(
    "-f, --filter <keyword>",
    'Filter by tech (e.g., "react", "ai", "tool")'
  )
  .option("-l, --limit <number>", "Number of items to discover", "20")
  .action(async (options) => {
    console.log(
      "\x1b[96m🚀 AppScope\x1b[0m - \x1b[37mDiscovering apps, tools & projects...\x1b[0m"
    );
    console.log("\x1b[90m📡 Fetching from developer community...\x1b[0m\n");

    const articles = await fetchDailyDevFeed(parseInt(options.limit));

    if (articles.length === 0) {
      console.log(
        "\x1b[31m❌ No apps found. Please check your connection and try again.\x1b[0m"
      );
      return;
    }

    let filteredArticles = articles;
    if (options.filter) {
      filteredArticles = articles.filter((article) =>
        article.title.toLowerCase().includes(options.filter.toLowerCase())
      );
      console.log(
        `\x1b[96m🔍 Filtered by "${options.filter}" - found ${filteredArticles.length} matches\x1b[0m`
      );
    }

    const clusters = clusterArticles(filteredArticles);

    if (clusters.length === 0) {
      console.log("\x1b[31m❌ No apps found matching your criteria.\x1b[0m");
      return;
    }

    const totalApps = clusters.reduce(
      (sum, cluster) => sum + cluster.articles.length,
      0
    );
    console.log(
      `\x1b[32m✨ Ready! Found ${clusters.length} categories with ${totalApps} apps/tools\x1b[0m`
    );
    console.log(
      '\x1b[90m🎯 Use arrow keys to navigate, "o" to open apps, "?" for help\x1b[0m\n'
    );

    setTimeout(async () => {
      await runInteractiveDashboard(clusters);
    }, 1500);
  });

program.parse();
