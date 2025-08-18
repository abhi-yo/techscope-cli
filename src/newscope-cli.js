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

async function fetchDailyTechFeed(limit = 20) {
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
        source: { name: "Tech News" },
        tags: [],
      }));
  } catch (error) {
    console.error("Error fetching articles:", error.message);
    return [];
  }
}

function displayDashboard(clusters, selectedCluster = 0, showHelp = false) {
  console.clear();

  // Header
  console.log("\n🚀 \x1b[1m\x1b[36mTechScope - Tech Content Dashboard\x1b[0m");
  console.log("\x1b[90m" + "─".repeat(60) + "\x1b[0m");
  console.log("\x1b[90mDiscover trending tech content in your terminal\x1b[0m");
  console.log(
    "\x1b[90m" +
      new Date().toLocaleString() +
      " • Press \x1b[33m?\x1b[90m for help\x1b[0m\n"
  );

  if (showHelp) {
    console.log("\x1b[1m\x1b[93m📖 Quick Help:\x1b[0m");
    console.log("\x1b[90m• \x1b[33m↑↓\x1b[90m navigate topics");
    console.log("\x1b[90m• \x1b[33mo\x1b[90m open selected link");
    console.log("\x1b[90m• \x1b[33mr\x1b[90m refresh");
    console.log("\x1b[90m• \x1b[33mq\x1b[90m quit\x1b[0m\n");
  }

  // Topics list
  console.log("\x1b[1m🔥 Topics:\x1b[0m");
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

  // Selected cluster details (no type/date line)
  if (clusters[selectedCluster]) {
    const cluster = clusters[selectedCluster];
    console.log(`\n\x1b[1m🔗 Content in "${cluster.headline}":\x1b[0m`);
    cluster.articles.forEach((article, i) => {
      const isRepo =
        article.url &&
        (article.url.includes("github.com") ||
          article.url.includes("gitlab.com"));
      const icon = isRepo ? "📦" : "🔗";
      const title = `\x1b[32m${article.title.slice(0, 70)}${
        article.title.length > 70 ? "..." : ""
      }\x1b[0m`;
      console.log(`  ${icon} ${title}`);
    });
  }

  // Controls
  console.log("\n\x1b[90m" + "─".repeat(60) + "\x1b[0m");
  console.log(
    "\x1b[1m\x1b[93mControls:\x1b[0m \x1b[33m[↑↓]\x1b[0m Navigate \x1b[33m[o]\x1b[0m Open \x1b[33m[r]\x1b[0m Refresh \x1b[33m[?]\x1b[0m Help \x1b[33m[q]\x1b[0m Quit"
  );
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
        stdin.setRawMode(false);
        console.log("\n\x1b[32m👋 Goodbye!\x1b[0m\n");
        resolve();
        return;
      }

      if (key === "?") {
        showHelp = !showHelp;
        displayDashboard(clusters, selectedCluster, showHelp);
      } else if (key === "\u001B[A" && selectedCluster > 0) {
        selectedCluster--;
        displayDashboard(clusters, selectedCluster, showHelp);
      } else if (key === "\u001B[B" && selectedCluster < clusters.length - 1) {
        selectedCluster++;
        displayDashboard(clusters, selectedCluster, showHelp);
      } else if (key === "o" && clusters[selectedCluster]) {
        const article = clusters[selectedCluster].articles[0];
        console.log(`\n\x1b[32mOpening: ${article.title}\x1b[0m`);
        console.log(`\x1b[90m→ ${article.url}\x1b[0m`);
        await open(article.url);
        setTimeout(
          () => displayDashboard(clusters, selectedCluster, showHelp),
          1500
        );
      } else if (key === "r") {
        console.log("\n\x1b[33mRefreshing...\x1b[0m");
        const articles = await fetchDailyTechFeed();
        clusters = clusterArticles(articles);
        selectedCluster = 0;
        displayDashboard(clusters, selectedCluster, showHelp);
      }
    });
  });
}

const program = new Command();

program
  .name("techscope")
  .description("Terminal-based tech content reader")
  .version("1.0.0")
  .option(
    "-f, --filter <keyword>",
    'Filter by keyword (e.g., "react", "ai", "rust")'
  )
  .option("-l, --limit <number>", "Number of items to fetch", "20")
  .action(async (options) => {
    console.log("\x1b[33m🔍 Fetching tech news...\x1b[0m");

    const articles = await fetchDailyTechFeed(parseInt(options.limit));
    if (articles.length === 0) {
      console.log("\x1b[31m❌ No content found.\x1b[0m");
      return;
    }

    let filteredArticles = articles;
    if (options.filter) {
      filteredArticles = articles.filter((article) =>
        article.title.toLowerCase().includes(options.filter.toLowerCase())
      );
      console.log(
        `\x1b[36m🔎 Filtered by "${options.filter}" - ${filteredArticles.length} matches\x1b[0m`
      );
    }

    const clusters = clusterArticles(filteredArticles);
    if (clusters.length === 0) {
      console.log("\x1b[31m❌ No content found matching your criteria.\x1b[0m");
      return;
    }

    console.log(
      `\x1b[32m✅ Found ${clusters.length} topics with ${filteredArticles.length} items\x1b[0m`
    );
    setTimeout(async () => {
      await runInteractiveDashboard(clusters);
    }, 1000);
  });

program.parse();
