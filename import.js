const util = require('util');
const fs = require('fs');
const path = require('path');
const api = require('./api');

const sleep = util.promisify(setTimeout);


module.exports = async (argv) => {
	
	const dir = path.resolve(argv.storage);
	const dirs = await util.promisify(fs.readdir)(dir);
	const files = [];
	
	for(const group of dirs) {
		const f = await util.promisify(fs.readdir)(path.resolve(dir, group));
		files.push(...(f.map(a=>a.split('.').pop() === 'gz' ? ({file: [group, a]}) : '').filter(a=>a)));
	}
	// console.log(dirs, files);

	console.log(`Found ${files.length} files to be imported`);

	for(const {file} of files) {
		// console.log(file);
		[err, data] = await api.createGroup(argv.domain, argv.token, file[0]);
		if (err) {
			console.log(`Can't create group ${file[0]}: "${err}"`);
		}
		else {
			console.log(`Created group ${file[0]}`);
		}

		console.log(`Start import ${file[0]}/${file[1].split('.')[0]}`);
		[err, p] = await api.importProject(
			argv.domain, 
			argv.token, 
			path.resolve(dir, ...file), 
			file[0], 
			file[1].split('.')[0]
		);
		if (err) {
			console.log(`Can't import project ${file[0]}/${file[1].split('.')[0]}: "${err}"`);
		}
		else {
			console.log(`Imported ${file[0]}/${file[1].split('.')[0]}`);
		}
	}

}