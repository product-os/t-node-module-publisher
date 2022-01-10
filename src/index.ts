import { createOutputDir, inputDir, readInput, writeOutputs } from './transformer';
import path = require('path');
import * as zx from 'zx'
import * as fs from 'fs/promises'
import * as os from 'os'
import { ProcessOutput } from 'zx'

const run = async () => {
	const input = await readInput();
	console.log('input:', input.contract);
	console.log('input directory:', input.artifactPath);
	const outputDir = await createOutputDir();
	console.log('output directory:', outputDir);

	// Check to make sure we've got a backflow of the node module
	const backflow = Object.values(input.contract.data.$transformer.backflow).filter((bfItem) => bfItem.type.startsWith('type-product-os-t-node-module@'))[0];

	if (!backflow) {
		console.error('[PUBLISHER] Did not find a node module backflow!');
		console.error(
			`GOT input: ${JSON.stringify(
				input.contract.data.$transformer,
			)}`,
		);
		process.exit(1);
	}

	try {
		const backflowPath = path.join(inputDir, backflow.id)
		await zx.$`cp -r ${path.join(backflowPath, 'artifact')} /tmp`

		// Write the decrypted secret
		const secrets = {
			...input.decryptedSecrets,
			...input.decryptedTransformerSecrets,
		} as any;
		if (secrets['NPM_TOKEN']) {
			console.log('[PUBLISHER] NPM TOKEN LEN:', secrets['NPM_TOKEN'].length)
			await fs.writeFile(path.join(os.homedir(), '.npmrc'), `//registry.npmjs.org/:_authToken=${secrets['NPM_TOKEN']}`)
		} else {
			console.error('[PUBLISHER] Failed to find NPM_TOKEN secret, exiting!')
			process.exit(1)
		}

		console.log('[PUBLISHER] Publishing package to npm...')
		if (input.contract.version.includes('-pr-')) {
			console.log('[PUBLISHER] This is a pre-release version:', input.contract.version)
		}

		// Change package.json version
		const pkgJSON = JSON.parse(await fs.readFile(path.join('/', 'tmp', 'artifact', 'package.json'), { encoding: 'utf-8' }))
		pkgJSON.version = input.contract.version
		await fs.writeFile(path.join('/', 'tmp', 'artifact', 'package.json'), JSON.stringify(pkgJSON, null, 2))
		console.log('[PUBLISHER] Update package.json version')

		// Change package-lock.json version
		const pkgLockJSON = JSON.parse(await fs.readFile(path.join('/', 'tmp', 'artifact', 'package-lock.json'), { encoding: 'utf-8' }))
		pkgLockJSON.version = input.contract.version
		await fs.writeFile(path.join('/', 'tmp', 'artifact', 'package-lock.json'), JSON.stringify(pkgLockJSON, null, 2))
		console.log('[PUBLISHER] Update package-lock.json version')

		console.log('[PUBLISHER] run npm whoami')
		const whoamiOut = await zx.$`npm whoami`
		console.log(whoamiOut.stdout)
		console.log(whoamiOut.stderr)

		console.log('[PUBLISHER] Publishing version', input.contract.version)
		const out = await zx.$`cd /tmp/artifact && npm publish`
		console.log('stdout', out.stdout)
		console.log('stderr', out.stderr)

		console.log('[PUBLISHER] Successfully published to npm')
	} catch (error) {
		if (error instanceof ProcessOutput) {
			console.error('Command returned an error!')
			console.error(error.toString())
		} else {
			throw error
		}
	}

	const outContract = {
		type: 'type-product-os-t-node-module@1.0.7',
		data: {
			packageName: input.contract.data.packageName
		},
	};

	await writeOutputs([
		{ contract: outContract, artifactType: 'artifact', path: outputDir },
	]);
};

run().catch((err) => {
	console.log('ERROR IN TRANSFORMER', err);
	process.exit(1);
});
