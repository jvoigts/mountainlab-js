#!/usr/bin/env node

var program = require('commander');

var package_json = require('./package.json');

var program = require('commander');

program
  .command('list-processors [pattern]')
  .description('List MountainLab processors installed on this machine. Optionally specify a wildcard pattern for filtering the results.')
  .option('--package [package-name]', 'Specify ML processor package by name')
  .option('--package_uri [package-uri]', 'Specify ML processor package by URI')
  .action(function (pattern, cmd) {
  	cmd.pattern=pattern;
  	require(__dirname+'/list_processors.js').list_processors(cmd);
  });

program.parse(process.argv);
