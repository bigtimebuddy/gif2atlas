#!/usr/bin/env node

const minimist = require('minimist');
const chalk = require('chalk');
const extractFrames = require('gif-extract-frames');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { Atlasify, Options } = require('atlasify');

async function main() {
    const args = minimist(process.argv.slice(2), {
        string: ['size', 'out'],
        boolean: ['pot', 'verbose'],
        alias: {
            size: 's',
            out: 'o',
            verbose: 'v',
        },
        default: {
            size: '1024',
            pot: true,
            verbose: false,
        }
    });

    const images = args._.filter(f => f.endsWith('.gif'));
    if (images.length === 0) {
        console.log(chalk.red('ERROR: No gif files specified.'));
        process.exit(1);
    }

    try {
        await Promise.all(images.map(image => processImage(image, args))); 
    }
    catch (err) {
        console.log(chalk.red('ERROR:' + err));
        process.exit(1);
    }
}



async function processImage(image, { size, pot, out, verbose }) {

    const info = verbose ? (message) => console.log(chalk.gray(message)) : () => null;
    const success = (message) => console.log(chalk.green(message));

    const name = path.basename(image, '.gif');
    const input = path.resolve(image);

    success(`Generating atlas from ${chalk.bold(image)}`);

    // Create a temp folder to store the frames
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'pixi-gif-'));
    let result;

    try {
        info(`extracting frames...`);
        // Extract the frames to folder
        const results = await extractFrames({
            input,
            output: path.join(temp, 'frame-%d.png')
        });

        // Pack all the images
        const s = parseInt(size);
        const options = new Options(path.resolve(`${name}.png`), s, s);
        options.extrude = 1;
        options.padding = 1;
        options.pot = pot;

        const packer = new Atlasify(options);
        const files = (await fs.readdir(temp)).map(f => path.join(temp, f));

        info('creating atlas from frames...');
        result = await packer.addURLs(files);
    }
    finally {
        info('cleanup temporary folder...');
        await fs.remove(temp);
    }   

    const output = out ? path.resolve(out) : path.dirname(input);
    
    info('saving atlases...');
    for (const a of result.atlas) {
        const imageName = path.join(output, `${a.name}.${a.ext}`);
        await a.image.writeAsync(imageName);
    }

    info('saving spritesheets...');
    for (const s of result.spritesheets) {
        const sheetName = path.join(output, `${s.name}.${s.ext}`);
        await fs.writeFile(sheetName, result.exporter.compile(s), 'utf-8');
    }

    info('done.');
}

main();