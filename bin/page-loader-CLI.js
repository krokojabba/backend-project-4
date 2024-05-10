#!/usr/bin/env node
import { Command } from 'commander';
import process from 'node:process';
import pageLoader from '../src/pageLoader.js';

const program = new Command();

program
  .version('0.0.1', '-v, --version', 'output the version number')
  .description('Page loader utility')
  .argument('<url>')
  .option('-o, --output [dir]', 'output dir (default: "/home/user/current-dir")', process.cwd())
  .action((url, options) => {
    pageLoader(url, options.output)
      .then((message) => {
        console.log(message);
        process.exit(0);
      })
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
  });

program.parse();
