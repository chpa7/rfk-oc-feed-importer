#!/usr/bin/env node

/* tslint:disable: no-console */
import { Option, program } from 'commander';
import packageInfo from './package.json';
import feedimporter from './src/index';
import chalk from 'chalk';
import figlet from 'figlet';
import clear from 'clear';
import ora from 'ora';

// display banner
clear();
console.log(chalk.cyanBright(figlet.textSync('sitecore', { horizontalLayout: 'full' })));

program
  .version(packageInfo.version, '-v, --version')
  .description('A tool to import a Reflektion feed into OrderCloud')
  .option('-u, --username <string>', 'username for portal credentials https://ordercloud.io/')
  .option('-p, --password <string>', 'password for portal credentials https://ordercloud.io/')
  .option(
    '-m --marketplaceID <string>',
    'ID for the OrderCloud marketplace where products should be loaded into'
  )
  .addOption(
    new Option('-t, --template <type>', 'an existing template feed')
      .choices(['riggsandporter'])
      .default('riggsandporter')
  )
  .option(
    '-f, --filepath <path>',
    'filepath to a reflektion feed, should adhere to reflektion standard'
  )
  .addOption(
    new Option('-e, --environment <ordercloudenvironment>')
      .choices(['sandbox', 'staging', 'production'])
      .default('sandbox')
  )
  .option(
    '-e, --environment <ordercloudenvironment>',
    'The ordercloud environment to seed data against'
  )
  .parse(process.argv);

const options = program.opts();
options.username = process.env.DEBUG_USERNAME || options.username;
options.password = process.env.DEBUG_PASSWORD || options.username;
options.marketplaceID = process.env.DEBUG_MARKETPLACE_ID || options.marketplaceID;
options.template = process.env.DEBUG_TEMPLATE || options.template;
options.filepath = process.env.DEBUG_FILEPATH || options.filepath;
options.environment = process.env.DEBUG_ENVIRONMENT || options.environment;

if (!options.username) {
  console.error(chalk.bold.red('> Portal username must be provided'));
  program.help(); // This exits the process
}

if (!options.password) {
  console.error(chalk.bold.red('> Portal password must be provided'));
  program.help(); // This exits the process
}

if (!options.marketplaceID) {
  console.error(chalk.bold.red('> Marketplace ID must be provided'));
  program.help(); // This exits the process
}

// error on unknown commands
program.on('command:*', function () {
  console.error(chalk.bold.red('> Invalid command: See list of available commands.'));
  program.help(); // This exits the process
});

const spinner = ora().start();
feedimporter
  .run({
    username: options.username,
    password: options.password,
    marketplaceID: options.marketplaceID,
    template: options.template,
    filepath: options.filepath,
    environment: options.environment,
  })
  .then(() => {
    spinner.stop();
    console.log(chalk.greenBright('Done! ✨'));
    console.log(
      chalk.yellowBright('Check out your shiny new products ') +
        chalk.magentaBright('on ordercloud') +
        chalk.yellowBright('.')
    );
  })
  .catch(err => {
    spinner.stop();
    console.error(chalk.redBright('Aaww 💩 Something went wrong:'));
    console.error(chalk.redBright(err.stack));
    console.log('');
    console.error(chalk.redBright(err.message || err.statusText));
    if (err.isOrderCloudError) {
      console.error(
        chalk.redBright(
          `${err.request.method} ${err.request.protocol + err.request.host + err.request.path}`
        )
      );
      console.error(chalk.redBright(JSON.stringify(err.errors, null, 4)));
    }
    process.exit(1); // prevent execution of another command after this
  });

process.on('unhandledRejection', err => console.error(err));
