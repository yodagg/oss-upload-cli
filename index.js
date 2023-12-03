import { Command } from 'commander'
import pkg from './package.json' assert { type: 'json' }
import upload from './upload.js'

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
