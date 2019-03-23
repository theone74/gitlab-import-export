const util = require('util');
const api = require('./api');

const sleep = util.promisify(setTimeout);


module.exports = (argv) => {
	
	const domain = argv.domain;
	const token = argv.token;
	
	
	
	let projects = [];
	global.projects = projects;
	
	// get projects
	(async ()=>{
		let err, p;
		let i = 1;
		do {
			p = await api.getProjects(domain, token, i++);
			projects.push(...p);
			console.log(`Added ${p.length} projects`);
			// break;
		} while(p.length);
		if (!projects.length) {
			console.log('No projects found.')
			process.exit();
		}
	})();
	
	
	// request export
	(async ()=>{
		let err, p;
		while(true) {
			for(const project of projects) {
				if (project.requested) continue;
	
				console.log(`Request export #${project.id}: ${project.name_with_namespace}`);
				[err, p] = await api.requestExport(domain, token, project.id);
	
				if (err) {
					console.log(`Can't request export project #${project.id}: ${project.name_with_namespace}`);
					project.error = true;
				}
				else {
					project.requested = true;
				}
			}
			await sleep(1000);
		}
	})();
	
	
	// check exported
	(async ()=>{
		let err, p;
		while(true) {
			for(const project of projects) {
				if (!project.requested || project.exported) continue;
	
				console.log(`Check #${project.id}: ${project.name_with_namespace} ... `);
				[err, p] = await api.checkExport(domain, token, project.id);
				if (err) {
					console.log(`Can't request export project`);
					project.error = true;
				}
				else {
					const status = p.export_status;
					if (status === 'finished') {
						project.exported = true;
						// process.stdout.write(`done`);
					}
					else {
						// console.log(`no`);
					}
				}
			}
			await sleep(1000);
		}
	})();
	
	// download
	(async ()=>{
		let err, p;
	
		while(true) {
			for(const project of projects) {
				if (!project.exported || project.downloaded) continue;
	
				console.log(`Download #${project.id}: ${project.name_with_namespace} ... `);
				[err] = await api.download(domain, token, project.id, argv.storage);
				if (err) {
					console.log(`Can't download project(${err})`);
					project.error = true;
				}
				else {
					console.log(`Download complete #${project.id}`);
					project.downloaded = true;
				}
			}
			if (projects.length>0 && projects.filter(p=>!(p.downloaded || p.error)).length === 0) {
				console.log('done');
				process.exit();
			}
			await sleep(1000);
		}
	})();
	
	(async ()=>{
		let projects = [];
		let i = 1;
		let err, p;
		do {
			p = await getProjects(i++);
			projects.push(...p);
			// break;
		} while(p.length);
		// console.log(projects.length);
	
	
		// p = await requestExport(projects[2].id);
		// console.log(p);
	
		for(const project of projects) {
			console.log(`Request export #${project.id}: ${project.name_with_namespace}`);
			[err, p] = await requestExport(project.id);
	
			if (err) {
				console.log(`Can't request export project #${project.id}: ${project.name_with_namespace}`);
			}
		}
	
		let done;// = await checkExportDone(projects);
		let doneprojects = [];
		let fnc;
		// setInterval(fnc = async ()=>{
		while(1) {
			console.log('Check export status ...');
			let done = await checkExportDone(projects);
			for(const project of projects) {
				if (project.done) continue;
				if (!done.includes(project.id)) continue;
				console.log('Done project:', project.id);
				[err] = await download(project.id);
				project.done = true;
				if (err) {
					console.log(`Can't download project ${project.id}: ${project.name_with_namespace}`);
				}
				// break;
			}
			if (projects.filter(p=>!p.done).length === 0) {
				console.log('done');
				process.exit();
			}
		}//, 60000);
		// fnc();
	
	
	});

	setInterval(()=>{
		let fields = ['requested', 'exported', 'downloaded', 'error'];
		let res = {};

		for(const project of projects) {
			for(const fld of fields) {
				if (!res[fld]) res[fld] = 0;
				if (project[fld]) {
					res[fld] ++;
				}
			}
		}

		if (res['requested']) {
			console.log(`PROGRESS requested=${res['requested']} \texported=${res['exported']} \tdownloaded=${res['downloaded']} \terror=${res['error']}`);
		}
	}, 10000);
}