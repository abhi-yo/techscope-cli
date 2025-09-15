#!/usr/bin/env node

import { Command } from "commander";
import fetch from "node-fetch";
import open from "open";
import chalk from "chalk";
import { 
  showBanner, 
  displayControls, 
  displayHelp,
  showSuccess, 
  showError,
  showInfo,
  showFound,
  createSpinner,
  showGoodbye
} from './ui-utils.js';

// Import clustering functions from both CLIs
async function fetchNewsArticles(limit = 20) {
  try {
    const topStoriesResponse = await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json"
    );
    const storyIds = await topStoriesResponse.json();

    if (!storyIds || storyIds.length === 0) {
      throw new Error("No stories available");
    }

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
        type: 'news'
      }));
  } catch (error) {
    console.error("Error fetching news:", error.message);
    return [];
  }
}

async function fetchApps(limit = 20) {
  try {
    const response = await fetch("https://daily.dev/api/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query {
            page: sourceFeed(
              first: ${limit}
              ranking: POPULARITY
              supportedTypes: [article]
            ) {
              edges {
                node {
                  id
                  title
                  permalink
                  createdAt
                  source {
                    name
                  }
                  tags
                }
              }
            }
          }
        `,
      }),
    });

    const data = await response.json();
    
    if (!data.data || !data.data.page || !data.data.page.edges) {
      throw new Error("Invalid response format");
    }

    return data.data.page.edges
      .map((edge) => edge.node)
      .filter((item) => item && item.title && item.permalink)
      .map((item) => ({
        id: item.id,
        title: item.title,
        url: item.permalink,
        createdAt: item.createdAt,
        source: item.source,
        tags: item.tags || [],
        type: 'app'
      }));
  } catch (error) {
    console.error("Error fetching apps:", error.message);
    return [];
  }
}

// Simple clustering function
function clusterItems(items) {
  const clusters = [];
  const processed = new Set();

  for (const item of items) {
    if (processed.has(item.id)) continue;

    const similar = items.filter((other) => {
      if (other.id === item.id || processed.has(other.id)) return false;
      return titleSimilarity(item.title, other.title) > 0.3;
    });

    const cluster = {
      id: clusters.length,
      headline: extractMainTopic(item.title),
      items: [item, ...similar],
      type: item.type
    };

    clusters.push(cluster);
    [item, ...similar].forEach((i) => processed.add(i.id));
  }

  return clusters.sort((a, b) => b.items.length - a.items.length);
}

function titleSimilarity(title1, title2) {
  const words1 = new Set(title1.toLowerCase().split(/\W+/));
  const words2 = new Set(title2.toLowerCase().split(/\W+/));
  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

function extractMainTopic(title) {
  const words = title.split(/\s+/);
  const significantWords = words.filter(
    (word) => word.length > 3 && !/^(the|and|for|with|from|this|that|will|have|been|are|was|were|but|not|you|all|can|had|her|his|how|its|may|new|now|old|see|way|who|boy|did|has|she|use|her|one|our|out|day|get|use|man|way|may)$/i.test(word)
  );
  
  return significantWords.slice(0, 3).join(" ") || title.slice(0, 30);
}

function displayUnifiedDashboard(allClusters, selectedIndex = 0, showHelpPanel = false) {
  console.clear();
  showBanner();

  if (showHelpPanel) {
    displayHelp();
    return;
  }

  const totalItems = allClusters.reduce((sum, cluster) => sum + cluster.items.length, 0);
  showFound(`Found ${allClusters.length} topics with ${totalItems} items`);

  // Display all topics mixed together
  if (allClusters.length > 0) {
    console.log(`\n${chalk.bold('Topics:')}`);
    
    allClusters.forEach((cluster, index) => {
      const isSelected = index === selectedIndex;
      const prefix = isSelected ? chalk.hex('#ff9999')('▶ ') : '  ';
      const textColor = isSelected ? chalk.white.bold : chalk.gray;
      const itemCount = chalk.dim(`(${cluster.items.length})`);
      
      console.log(`${prefix}${textColor(cluster.headline)} ${itemCount}`);
    });

    // Display selected cluster details
    if (allClusters[selectedIndex]) {
      const cluster = allClusters[selectedIndex];
      
      console.log(`\n${chalk.bold('Items in')} ${chalk.hex('#ff9999')(`"${cluster.headline}"`)}`);
      
      cluster.items.forEach((item, index) => {
        const isRepo = item.url && (
          item.url.includes('github.com') || 
          item.url.includes('gitlab.com')
        );
        const prefix = isRepo ? '[repo]' : (item.type === 'news' ? '[link]' : '[tool]');
        const truncatedTitle = item.title.length > 80 
          ? item.title.slice(0, 77) + '...'
          : item.title;
        
        console.log(`  ${chalk.dim(prefix)} ${chalk.gray(truncatedTitle)}`);
      });
    }
  }

  // Display controls
  console.log(`\n${chalk.dim('↑↓')} Navigate  ${chalk.dim('o')} Open  ${chalk.dim('r')} Refresh  ${chalk.dim('?')} Help  ${chalk.dim('m')} Menu  ${chalk.dim('q')} Quit`);
}

async function runUnifiedDashboard(allClusters) {
  let selectedIndex = 0;
  let showHelpPanel = false;

  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  displayUnifiedDashboard(allClusters, selectedIndex, showHelpPanel);

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
          displayUnifiedDashboard(allClusters, selectedIndex, showHelpPanel);
        } else if (key === "\u001B[A" && selectedIndex > 0) {
          selectedIndex--;
          displayUnifiedDashboard(allClusters, selectedIndex, showHelpPanel);
        } else if (key === "\u001B[B" && selectedIndex < allClusters.length - 1) {
          selectedIndex++;
          displayUnifiedDashboard(allClusters, selectedIndex, showHelpPanel);
        } else if (key === "o" && allClusters[selectedIndex]) {
          const item = allClusters[selectedIndex].items[0];
          console.log(`\nOpening: ${item.title}`);
          console.log(`${item.url}`);
          await open(item.url);
          setTimeout(
            () => displayUnifiedDashboard(allClusters, selectedIndex, showHelpPanel),
            2000
          );
        } else if (key === "r") {
          console.log('\nRefreshing content...');
          try {
            const [newsArticles, apps] = await Promise.all([
              fetchNewsArticles(20),
              fetchApps(20)
            ]);
            
            if (newsArticles.length > 0 || apps.length > 0) {
              // Mix all content together
              const allItems = [...newsArticles, ...apps];
              allClusters = clusterItems(allItems);
              selectedIndex = 0;
              console.log('✓ Content refreshed!');
            } else {
              console.log('✗ Failed to refresh content');
            }
          } catch (error) {
            console.log('✗ Failed to refresh content');
          }
          
          setTimeout(() => displayUnifiedDashboard(allClusters, selectedIndex, showHelpPanel), 1000);
        }
      } catch (error) {
        displayUnifiedDashboard(allClusters, selectedIndex, showHelpPanel);
      }
    };

    stdin.on("data", handleKeyPress);
  });
}

export async function startUnifiedTechScope(options = {}) {
  const spinner = createSpinner("Loading content...");
  spinner.start();

  try {
    const [newsArticles, apps] = await Promise.all([
      fetchNewsArticles(parseInt(options.limit || 20)),
      fetchApps(parseInt(options.limit || 20))
    ]);

    if (newsArticles.length === 0 && apps.length === 0) {
      spinner.fail();
      showError("No content found. Please check your connection and try again.");
      return;
    }

    spinner.stop();
    
    // Mix all content together
    const allItems = [...newsArticles, ...apps];
    const allClusters = clusterItems(allItems);

    setTimeout(async () => {
      try {
        const result = await runUnifiedDashboard(allClusters);
        if (result === 'menu') {
          return;
        }
      } catch (error) {
        // Handle user interruption gracefully
        if (error.message && (error.message.includes('force closed') || error.message.includes('SIGINT'))) {
          return; // Just return to menu, don't show error
        }
        throw error; // Re-throw other errors
      }
    }, 500);

  } catch (error) {
    spinner.fail();
    if (error.message && (error.message.includes('force closed') || error.message.includes('SIGINT'))) {
      return; // Handle gracefully without error message
    }
    showError(`Error loading content: ${error.message}`);
  }
}

const program = new Command();

program
  .name("techscope-unified")
  .description("Unified tech content discovery platform")
  .version("2.0.0")
  .option("-f, --filter <keyword>", 'Filter content by keyword')
  .option("-l, --limit <number>", "Number of items to fetch per section", "20")
  .action(async (options) => {
    await startUnifiedTechScope(options);
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}
