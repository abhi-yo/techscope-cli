#!/usr/bin/env node

import { Command } from "commander";
import fetch from "node-fetch";
import open from "open";
import { 
  showBanner, 
  displayTopics, 
  displayArticles, 
  displayControls, 
  displayHelp,
  showSuccess, 
  showError,
  showInfo,
  showFound,
  createSpinner,
  showGoodbye
} from './ui-utils.js';

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

function displayDashboard(clusters, selectedCluster = 0, showHelpPanel = false) {
  console.clear();
  showBanner();

  if (showHelpPanel) {
    displayHelp();
    return;
  }

  // Display topics
  displayTopics(clusters, selectedCluster);

  // Display selected cluster details
  if (clusters[selectedCluster]) {
    const cluster = clusters[selectedCluster];
    displayArticles(cluster.articles, cluster.headline);
  }

  // Display controls
  displayControls();
}

async function runInteractiveDashboard(clusters) {
  let selectedCluster = 0;
  let showHelpPanel = false;

  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  displayDashboard(clusters, selectedCluster, showHelpPanel);

  return new Promise((resolve) => {
    const handleKeyPress = async (key) => {
      try {
        if (key === "\u0003" || key === "q") {
          stdin.setRawMode(false);
          stdin.removeListener('data', handleKeyPress);
          showGoodbye();
          resolve();
          return;
        }

        if (key === "m") {
          stdin.setRawMode(false);
          stdin.removeListener('data', handleKeyPress);
          resolve('menu');
          return;
        }

        if (key === "?") {
          showHelpPanel = !showHelpPanel;
          displayDashboard(clusters, selectedCluster, showHelpPanel);
        } else if (key === "\u001B[A" && selectedCluster > 0) {
          selectedCluster--;
          displayDashboard(clusters, selectedCluster, showHelpPanel);
        } else if (key === "\u001B[B" && selectedCluster < clusters.length - 1) {
          selectedCluster++;
          displayDashboard(clusters, selectedCluster, showHelpPanel);
        } else if (key === "o" && clusters[selectedCluster]) {
          const article = clusters[selectedCluster].articles[0];
          console.log(`\nOpening: ${article.title}`);
          console.log(`${article.url}`);
          await open(article.url);
          setTimeout(
            () => displayDashboard(clusters, selectedCluster, showHelpPanel),
            1500
          );
        } else if (key === "r") {
          // Simple refresh without complex spinners
          console.log('\nRefreshing...');
          try {
            const articles = await fetchDailyTechFeed();
            if (articles && articles.length > 0) {
              clusters = clusterArticles(articles);
              selectedCluster = 0;
              console.log('✓ Content refreshed!');
            } else {
              console.log('✗ Failed to refresh content');
            }
          } catch (error) {
            console.log('✗ Failed to refresh content');
          }
          
          setTimeout(() => displayDashboard(clusters, selectedCluster, showHelpPanel), 1000);
        }
      } catch (error) {
        // Silently handle any errors and continue
        displayDashboard(clusters, selectedCluster, showHelpPanel);
      }
    };

    stdin.on("data", handleKeyPress);
  });
}

// Export for use by main CLI
export async function startNewsReader(options = {}) {
  const spinner = createSpinner('Fetching tech news...');
  spinner.start();

  const articles = await fetchDailyTechFeed(parseInt(options.limit || 20));
  
  if (articles.length === 0) {
    spinner.fail();
    showError("No content found.");
    return;
  }

  let filteredArticles = articles;
  if (options.filter) {
    filteredArticles = articles.filter((article) =>
      article.title.toLowerCase().includes(options.filter.toLowerCase())
    );
    if (filteredArticles.length === 0) {
      spinner.fail();
      showError(`No content found matching "${options.filter}".`);
      return;
    }
    spinner.stop();
    showFound(`Filtered by "${options.filter}" - ${filteredArticles.length} matches`);
  } else {
    spinner.stop();
    showFound(`Found ${articles.length} articles`);
  }

  const clusters = clusterArticles(filteredArticles);
  if (clusters.length === 0) {
    showError("No content found matching your criteria.");
    return;
  }

  showFound(`Organized into ${clusters.length} topics`);
  
  setTimeout(async () => {
    const result = await runInteractiveDashboard(clusters);
    if (result === 'menu') {
      return; // Return to main menu
    }
  }, 1000);
}

const program = new Command();

program
  .name("techscope-news")
  .description("Terminal-based tech news reader")
  .version("2.0.0")
  .option(
    "-f, --filter <keyword>",
    'Filter by keyword (e.g., "react", "ai", "rust")'
  )
  .option("-l, --limit <number>", "Number of items to fetch", "20")
  .action(async (options) => {
    await startNewsReader(options);
  });

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}
