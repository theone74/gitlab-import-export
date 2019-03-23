#!/usr/bin/env node

const util = require('util');
const api = require('./api');

const sleep = util.promisify(setTimeout);

const argv = require('yargs')
	.option('domain', {alias: 'd', type: 'string', default: 'gitlab.com'})
	.option('token', {alias: 't', type: 'string', demandOption: true})
	.option('storage', {alias: 's', type: 'string', default: '.'})
	.option('import', {alias: 'i', type: 'boolean', default: false})
	.help('help')
	.argv;


if (argv.import) {
	require('./import')(argv);
}
else {
	require('./export')(argv);
}