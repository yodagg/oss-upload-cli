import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import upload from './upload.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'))

const program = new Command()

program
    .name(pkg.name)
    .description(pkg.description)
    .version(pkg.version)
    .option('-s, --source <value>', '本地文件｜目录')
    .option('-t, --target <value>', '远程目录')
    .option('-key, --accessKeyId <value>', 'oss accessKeyId')
    .option('-secret, --accessKeySecret <value>', 'oss accessKeySecret')
    .option('-b, --bucket <value>', 'oss bucket')
    .option('-r, --region <value>', 'oss region')
    .action(upload)
    .parse(process.argv)
