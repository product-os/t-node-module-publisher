import { createOutputDir, inputDir, readInput, writeOutputs } from './transformer';
import * as packlist from 'npm-packlist';
import path = require('path');
import * as tar from 'tar'

console.log('Template Transformer starting');

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

	console.log('[PUBLISHER] Found backflow, Tarballing source')
	// Get what files should be tar'd
	const buildPath = path.join(
		inputDir,
		backflow.id
	);
	const filesToTar = await packlist({ path: buildPath })
	console.log('[PUBLISHER] Going to tar the following files:')
	console.log(JSON.stringify(filesToTar))
	const tarballPath = path.join(outputDir, 'bundle.tgz')
	await tar.create({
		gzip: true,
		cwd: buildPath,
		file: tarballPath,
		prefix: 'package/'
	}, filesToTar)

	console.log('[PUBLISHER] Successfully tarballed source')

	const version = input.contract.version

	console.log('[PUBLISHER] I would publish version', version)

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
