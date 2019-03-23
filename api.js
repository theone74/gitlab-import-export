
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const util = require('util');
const path = require('path');
const url = require('url');
const fs = require('fs');
const request = require('request');

require('request-debug')(request, function(type, data, r) {
	console.dir(type, {depth: null});//, data, r);
	console.dir(data, {depth: null});//, data, r);
	console.dir(r, {depth: null});//, data, r);
});

exports.doRequest2 = 
function performRequest(options) {
	return new Promise((resolve, reject) => {
		request(
			options,
			function(response,a) {
				console.log(response, a);
				const chunks = [];
				response.on('data', (chunk) => { chunks.push(chunk) });
				response.on('end', () => { resolve([Buffer.concat(chunks), response.statusCode, response.headers]) });
			}
		)
		.end();
	})
}


exports.doRequest = 
function doRequest(options) {
	const proto = options.protocol | 'http:';
	// console.log('START REQUEST', util.format('%s %s//%s%s', options.method || 'GET', proto, options.host, options.path));
	return new Promise ((resolve, reject) => {
		let req = (proto === 'http:' ? http : https).request(options);
		let buffer = [];

		req.on('response', res => {
			if (res.headers['content-encoding'] == 'gzip') {
				let gunzip = zlib.createGunzip();
				res.pipe(gunzip);
				gunzip
					.on('data', (data) => {buffer.push(data.toString())})
					.on("end", ()      => {resolve([Buffer.concat(buffer), res.statusCode, res.headers])})
					.on("error", e     => {resolve([Buffer.alloc(0), -1, []]);})
			}
			else {
				// res.setEncoding('utf8');
				res.on('data', chunk => {buffer.push(chunk)});
				res.on('end', () => {resolve([Buffer.concat(buffer), res.statusCode, res.headers])});
			}
		});
	
		req.on('error', e => {
			resolve([Buffer.alloc(0), -1, []]);
		});

		req.end();
	}); 
}


exports.getProjects = 
async function getProjects(domain, token, p=1) {
	const options = {
		host:     domain,
		port:     443,
		path:     `/api/v4/projects?per_page=999&page=${p}&membership=false&owned=false&simple=true&private_token=` + token,
		method:   'GET',
		protocol: 'https:',
		headers: {
			"Accept":              "application/json",
		}
	};

	[data, status] = await exports.doRequest(options);
	if (status !== 200) {
		throw new Error(`Can't read project list`);
	}

	return JSON.parse(data.toString());
}

exports.requestExport = 
async function requestExport(domain, token, id) {
	const options = {
		host:     domain,
		port:     443,
		path:     `/api/v4/projects/${id}/export`,
		method:   'POST',
		protocol: 'https:',
		headers: {
			"Accept":              "application/json",
			"PRIVATE-TOKEN":       token,
		}
	};

	[data, status] = await exports.doRequest(options);
	// console.log(data.toString(), status);
	if (status !== 202) {
		let p = data.toString();
		// throw new Error(`Can't request export ${p.message}`);
		return [`Can't request export ${p.message}`, null];
	}

	return [null, JSON.parse(data.toString())];
}

exports.checkExport = 
async function checkExport(domain, token, id) {
	const options = {
		host:     domain,
		port:     443,
		path:     `/api/v4/projects/${id}/export`,
		method:   'GET',
		protocol: 'https:',
		headers: {
			"Accept":              "application/json",
			"PRIVATE-TOKEN":       token,
		}
	};

	[data, status] = await exports.doRequest(options);
	// console.log(data.toString(), status);
	if (status !== 200) {
		let p = data.toString();
		// throw new Error(`Can't check export status ${p.message}`);
		return [`Can't check export status ${status}: "${p}" `, null];
	}

	return [null, JSON.parse(data.toString())];
}

exports.checkExportDone = 
async function checkExportDone(projects) {
	let err, p;
	let res = [];
	let wait = [];
	for(const project of projects) {
		if (project.done) continue;
		console.log(`check #${project.id}: ${project.name_with_namespace}`);
		// wait.push(checkExport(project.id));
		[err, p] = await exports.checkExport(project.id);
		if (err) {
			console.log(`Can't request export project ${project.id}: ${project.name_with_namespace}`);
		}
		else {
			let status = p.export_status;
			if (status === 'finished') {
				res.push(project.id);
			}
		}
	}
	return res;
}


exports.download = 
async function download(domain, token, id, dir) {

	let [err, info] = await exports.checkExport(domain, token, id);
	if (err) {
		console.error(info);
		return [err, null];
	}

	const options = {
		host:     domain,
		port:     443,
		path:     `/api/v4/projects/${id}/export/download`,
		method:   'GET',
		protocol: 'https:',
		headers: {
			"PRIVATE-TOKEN":       token,
		}
	};

	// curl --header "PRIVATE-TOKEN: <your_access_token>" --remote-header-name --remote-name https://gitlab.example.com/api/v4/projects/5/export/download
	// const options = url.parse(info._links.web_url);
	// console.log(url1);

	[data, status] = await exports.doRequest(options);
	// console.log(status, info);
	let name = path.resolve(dir, `${info.path_with_namespace}.tar.gz`);
	await util.promisify(fs.mkdir)(path.dirname(name), {recursive: true});
	await util.promisify(fs.writeFile)(name, data);
	return [null, null];
	// if (status !== 200) {
	// 	let p = data.toString();
	// 	// throw new Error(`Can't check export status ${p.message}`);
	// 	return [`Can't check export status ${p.message}`, null];
	// }

	// return [null, JSON.parse(data.toString())];
}

exports.importFile = 
async function importFile(domain, token, filedata, ns, projname) {
	const options = {
		method:   'POST',
		uri: `https://${domain}/api/v4/projects/import`,
		formData : {
			// "file" : filedata,
			file: {
				value:  filedata,
				options: {
					filename: projname,
					contentType: 'application/octet-stream'
				}
			},
			// "namespace": 3,
			"path": projname,
			// "overwrite": 'true',
		}
	};


	try{
		let res = await util.promisify(request.post)(options);
		console.log(res.body, res.statusCode);
		return [res.body, res.statusCode]
	}
	catch(e) {
		return [e];
	}

}


exports.importProject = 
async function importProject(domain, token, filename, ns, projname) {

	var exec = require('child_process').exec;

	let cmd = `curl -qs --request POST --header "PRIVATE-TOKEN: ${token}" --form "namespace=${ns}" --form "path=${projname}" --form "file=@${filename}" https://${domain}/api/v4/projects/import`;

	try {
		let {stdout, stderr} = await util.promisify(exec)(cmd);
		let data = JSON.parse(stdout)
		if (data.message) {
			return [data.message, data, stderr];
		}
		return [null, data, stderr]
	}
	catch(e) {
		const {code, stdout, stderr} = e;
		return [e.message, stdout, stderr, code]
	}

	return;

}

exports.createProject = 
async function createProject(domain, token, ns, projname) {
	const options = {
		host:     domain,
		port:     443,
		path:     `/api/v4/projects/?name=test`,
		method:   'POST',
		protocol: 'https:',
		headers: {
			"PRIVATE-TOKEN":       token,
		},
		// formData : {
		// 	"name" : projname,
		// 	"visibility": "private",
		// }
	};

	[data, status] = await exports.doRequest(options);
	console.log(data.toString(), status);
}

exports.createGroup = 
async function createGroup(domain, token, name) {
	const options = {
		host:     domain,
		port:     443,
		path:     `/api/v4/groups/?name=${name}&path=${name}`,
		method:   'POST',
		protocol: 'https:',
		headers: {
			"PRIVATE-TOKEN":       token,
		},
	};

	let [data, status] = await exports.doRequest(options);
	// console.log(data.toString(), status, name);
	data = JSON.parse(data.toString());
	if (data.message) {
		return [data.message, data];
	}
	return [null, data]
}

exports.moveToGroup = 
async function moveToGroup(domain, token, project, group) {
	const options = {
		host:     domain,
		port:     443,
		path:     `/groups/${group}/projects/${project}`,
		method:   'POST',
		protocol: 'https:',
		headers: {
			"PRIVATE-TOKEN":       token,
		},
	};

	[data, status] = await exports.doRequest(options);
	console.log(data.toString(), status);
}