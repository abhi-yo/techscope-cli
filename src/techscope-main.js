#!/usr/bin/env node

import { Command } from 'commander';
import { 
  showBanner, 
  projectSelector, 
  showSuccess, 
  showError,
  animatedLoading,
  configureSettings,
  showGoodbye
} from './ui-utils.js';
import { startUnifiedTechScope } from './unified-cli.js';

// Main application entry point
async function main() {
  let userSettings = { limit: 20 };
  
  try {
    while (true) {
      const selection = await projectSelector();
      
      switch (selection) {
        case 'techscope':
          await animatedLoading('Loading tech content...');
          await startUnifiedTechScope(userSettings);
          break;
          
        case 'settings':
          userSettings = await configureSettings();
          showSuccess(`Settings saved! Limit: ${userSettings.limit} items per section`);
          // Wait a moment to show the success message
          await new Promise(resolve => setTimeout(resolve, 2500));
          break;
          
        case 'exit':
          showGoodbye();
          process.exit(0);
          break;
          
        default:
          showError('Unknown selection');
      }
    }
  } catch (error) {
    // Handle user interruption gracefully
    if (error.message && error.message.includes('force closed') || error.message.includes('SIGINT')) {
      showGoodbye();
      process.exit(0);
    } else {
      showError(`Application error: ${error.message}`);
      process.exit(1);
    }
  }
}

// CLI program setup
const program = new Command();

program
  .name('techscope')
  .description('Terminal-based tech content discovery platform')
  .version('2.0.0')
  .option('-t, --techscope', 'Launch directly to unified TechScope view')
  .option('-l, --limit <number>', 'Number of items to fetch', '20')
  .action(async (options) => {
    // Direct launch option
    if (options.techscope) {
      showBanner();
      await animatedLoading('Loading tech content...');
      await startUnifiedTechScope({ limit: parseInt(options.limit) });
      return;
    }
    
    // Default interactive mode
    await main();
  });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n'); // Add a newline after ^C
  showGoodbye();
  process.exit(0);
});

// Handle other termination signals gracefully
process.on('SIGTERM', () => {
  showGoodbye();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  if (error.message && (error.message.includes('force closed') || error.message.includes('SIGINT'))) {
    console.log('\n');
    showGoodbye();
    process.exit(0);
  } else {
    console.error('Unexpected error occurred');
    process.exit(1);
  }
});

program.parse();
