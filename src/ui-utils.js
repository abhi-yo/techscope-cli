import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import inquirer from 'inquirer';
import ora from 'ora';

// Create gradient theme
const techGradient = gradient(['#ffc8c8ff', '#ff7b7bff', '#fc3838ff']);

// ASCII Art Generator
export function createLogo(text = 'TECHSCOPE') {
  try {
    const ascii = figlet.textSync(text, {
      font: 'ANSI Shadow',
      horizontalLayout: 'fitted',
      verticalLayout: 'fitted'
    });
    return techGradient(ascii);
  } catch (error) {
    // Fallback if font not available
    const ascii = figlet.textSync(text, {
      font: 'Standard',
      horizontalLayout: 'fitted'
    });
    return techGradient(ascii);
  }
}

// Enhanced header with branding
export function showBanner() {
  console.clear();
  console.log('\n');
  console.log(createLogo());
  console.log('\n');
}

// Loading spinner with style
export function createSpinner(text = 'Loading...') {
  return ora({
    text: chalk.hex('#ff9999')(text), // pastel red
    spinner: 'dots12',
    color: 'red'
  });
}

// Enhanced project selector
export async function projectSelector() {
  showBanner();
  
  const choices = [
    {
      name: 'Start',
      value: 'techscope'
    },
    {
      name: 'Settings',
      value: 'settings'
    },
    {
      name: 'Exit',
      value: 'exit'
    }
  ];

  const { selection } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selection',
      message: 'Choose an option:',
      choices,
      pageSize: 10
    }
  ]);

  return selection;
}

// Enhanced topic display
export function displayTopics(clusters, selectedIndex = 0) {
  console.log(chalk.bold('\nTopics:'));
  
  clusters.forEach((cluster, index) => {
    const isSelected = index === selectedIndex;
    const prefix = isSelected ? chalk.hex('#ff9999')('▶ ') : '  '; // pastel red
    const textColor = isSelected ? chalk.white.bold : chalk.gray;
    const articleCount = chalk.dim(`(${cluster.articles.length})`);
    
    console.log(`${prefix}${textColor(cluster.headline)} ${articleCount}`);
  });
}

// Enhanced article display
export function displayArticles(articles, title) {
  console.log(`\n${chalk.bold('Articles in')} ${chalk.hex('#ff9999')(`"${title}"`)}`); // pastel red
  
  articles.forEach((article, index) => {
    const isRepo = article.url && (
      article.url.includes('github.com') || 
      article.url.includes('gitlab.com')
    );
    const prefix = isRepo ? '[repo]' : '[link]';
    const truncatedTitle = article.title.length > 80 
      ? article.title.slice(0, 77) + '...'
      : article.title;
    
    console.log(`  ${chalk.dim(prefix)} ${chalk.gray(truncatedTitle)}`);
  });
}

// Enhanced apps/tools display
export function displayApps(apps, title) {
  console.log(`\n${chalk.bold('Apps in')} ${chalk.hex('#ff9999')(`"${title}"`)}`); // pastel red
  
  apps.forEach((app, index) => {
    const isRepo = app.url && (
      app.url.includes('github.com') || 
      app.url.includes('gitlab.com')
    );
    const prefix = isRepo ? '[repo]' : '[tool]';
    const truncatedTitle = app.title.length > 80 
      ? app.title.slice(0, 77) + '...'
      : app.title;
    
    console.log(`  ${chalk.dim(prefix)} ${chalk.gray(truncatedTitle)}`);
  });
}

// Enhanced controls display
export function displayControls() {
  console.log(`\n${chalk.dim('↑↓')} Navigate  ${chalk.dim('o')} Open  ${chalk.dim('r')} Refresh  ${chalk.dim('?')} Help  ${chalk.dim('m')} Menu  ${chalk.dim('q')} Quit`);
}

// Success message
export function showSuccess(message) {
  console.log(chalk.hex('#ff6666').bold(`${message}`)); // darker red for success
}

// Error message
export function showError(message) {
  console.log(chalk.red.bold(`${message}`));
}

// Info message
export function showInfo(message) {
  console.log(chalk.hex('#ffcccc').bold(`${message}`)); // light pastel red for info
}

// Found/count message in pastel red
export function showFound(message) {
  console.log(chalk.hex('#ff9999').bold(`${message}`)); // pastel red
}

// Warning message
export function showWarning(message) {
  console.log(chalk.hex('#ff9999').bold(`${message}`)); // pastel red
}

// Help display
export function displayHelp() {
  console.log(chalk.bold('\nHelp'));
  console.log('↑/↓     Navigate through topics');
  console.log('o       Open selected article');
  console.log('r       Refresh content');
  console.log('m       Return to main menu');
  console.log('?       Toggle this help');
  console.log('q       Quit TechScope');
}

// Animated loading message
export async function animatedLoading(message, duration = 2000) {
  const spinner = createSpinner(message);
  spinner.start();
  
  await new Promise(resolve => setTimeout(resolve, duration));
  
  spinner.succeed(chalk.hex('#ff6666')('Done!')); // darker red for success
}

// Configure settings
export async function configureSettings() {
  showBanner();
  
  const settings = await inquirer.prompt([
    {
      type: 'input',
      name: 'limit',
      message: 'How many items to fetch per section?',
      default: '20',
      validate: (input) => {
        const num = parseInt(input);
        if (isNaN(num) || num < 1 || num > 50) {
          return 'Please enter a number between 1 and 50';
        }
        return true;
      }
    }
  ]);

  // Convert limit to number
  settings.limit = parseInt(settings.limit);
  
  return settings;
}

// Cute goodbye message
export function showGoodbye() {
  console.clear();
  console.log('\n');
  
  try {
    const byeAscii = figlet.textSync('BYE!', {
      font: 'Standard',
      horizontalLayout: 'fitted'
    });
    console.log(chalk.hex('#ff9999')(byeAscii)); // pastel red
  } catch (error) {
    console.log(chalk.hex('#ff9999').bold('BYE!')); // pastel red
  }
  
  console.log(chalk.dim('\n   Thanks for using TechScope'));
  console.log(chalk.dim('   Stay curious, keep coding! ✨'));
  console.log('\n');
}
