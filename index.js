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
        alias: {
            size: 's',
            out: 'o',
        },
        default: {
            size: '1024'
        }
    });

    const images = args._.filter(f => f.endsWith('.gif'));
    if (images.length === 0) {
        console.log(chalk.red('ERROR: No gif files specified.'));
        process.exit(1);
    }

    try {
        const size = parseInt(args.size);
        await Promise.all(images.map(image => {
            return processImage(image, size, args.out);
        }));  
    }
    catch (err) {
        console.log(chalk.red('ERROR:' + err));
        process.exit(1);
    }
}

async function processImage(image, size, out) {
    const name = path.basename(image, '.gif');
    const input = path.resolve(image);
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'pixi-gif-'));
    const results = await extractFrames({
        input,
        output: path.join(temp, 'frame-%d.png')
    });
    const options = new Options(path.resolve(`${name}.png`), size, size);
    options.extrude = 1;
    options.trimAlpha = true;

    const packer = new Atlasify(options);
    const files = (await fs.readdir(temp)).map(f => path.join(temp, f));
    const result = await packer.addURLs(files);

    await fs.remove(temp);

    const output = out ? path.resolve(out) : path.dirname(input);
    
    for (const a of result.atlas) {
        const imageName = path.join(output, `${a.name}.${a.ext}`);
        await a.image.writeAsync(imageName);
    }

    for (const s of result.spritesheets) {
        const sheetName = path.join(output, `${s.name}.${s.ext}`);
        await fs.writeFile(sheetName, result.exporter.compile(s), 'utf-8');
    }
}

main();