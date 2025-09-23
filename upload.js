import oss from 'ali-oss'
import path from 'path'
import ora from 'ora'
import chalk from 'chalk'
import fs from 'fs'
import cliProgress from 'cli-progress'
import { getAllFilePaths, retryWithBackoff, limitConcurrency, classifyError, validateFiles } from './utils/index.js'

/**
 * 验证必需参数
 */
const validateArgs = (args) => {
    const requiredFields = [
        { key: 'source', name: '本地文件/目录路径' },
        { key: 'target', name: '远程目录路径' },
        { key: 'accessKeyId', name: 'OSS AccessKeyId' },
        { key: 'accessKeySecret', name: 'OSS AccessKeySecret' },
        { key: 'bucket', name: 'OSS Bucket' },
        { key: 'region', name: 'OSS Region' }
    ]
    
    const missingFields = requiredFields.filter(field => !args[field.key])
    
    if (missingFields.length > 0) {
        console.error(chalk.red('错误: 缺少必需参数:'))
        missingFields.forEach(field => {
            console.error(chalk.red(`  --${field.key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${field.name}`))
        })
        process.exit(1)
    }
    
    // 验证源文件/目录是否存在
    if (!fs.existsSync(args.source)) {
        console.error(chalk.red(`错误: 源文件/目录不存在: ${args.source}`))
        process.exit(1)
    }
}

let ossClientInstance = null

const getOssClient = (args) => {
    if (!ossClientInstance) {
        ossClientInstance = new oss({
            region: args.region,
            accessKeyId: args.accessKeyId,
            accessKeySecret: args.accessKeySecret,
            bucket: args.bucket,
        })
    }
    return ossClientInstance
}

const createUploadTask = (filename, args, client) => {
    return async () => {
        // 构建本地文件路径
        let localPath
        try {
            if (fs.statSync(args.source).isDirectory()) {
                // 如果 source 是目录，拼接文件名
                localPath = path.resolve(args.source, filename)
            } else {
                // 如果 source 是单个文件，直接使用 source 的绝对路径
                localPath = path.resolve(args.source)
            }
        } catch (error) {
            return { success: false, file: filename, error: `无法访问源文件: ${error.message}` }
        }
        
        const remotePath = path.posix.join(args.target, filename)
        const spinner = ora(chalk.yellow(`正在上传: ${filename}`)).start()
        
        try {
            const uploadFile = async () => {
                // 检查文件是否存在
                if (!fs.existsSync(localPath)) {
                    throw new Error(`文件不存在: ${localPath}`)
                }
                
                // 获取文件大小
                const stats = fs.statSync(localPath)
                const fileSize = stats.size
                const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024 // 50MB
                
                if (fileSize === 0) {
                    throw new Error('文件大小为0，无法上传空文件')
                }
                
                if (fileSize > LARGE_FILE_THRESHOLD) {
                    // 大文件使用流式上传
                    const stream = fs.createReadStream(localPath)
                    return await client.putStream(remotePath, stream)
                } else {
                    // 小文件直接上传
                    return await client.put(remotePath, localPath)
                }
            }
            
            const { url } = await retryWithBackoff(uploadFile, 3, 1000, 30000, true)
            spinner.succeed(chalk.green(`上传成功: ${url}`))
            return { success: true, file: filename, url }
        } catch (error) {
            const errorMsg = error.message || '未知错误'
            spinner.fail(chalk.red(`上传失败: ${filename} - ${errorMsg}`))
            if (process.env.NODE_ENV === 'development') {
                console.error(chalk.gray(`详细错误信息: ${error.stack || error}`))
            }
            return { success: false, file: filename, error: errorMsg }
        }
    }
}


export default async (args) => {
    try {
        // 验证参数
        validateArgs(args)
        
        const files = getAllFilePaths(args.source)
        
        if (files.length === 0) {
            console.log(chalk.yellow('没有找到需要上传的文件'))
            return
        }

    // 文件检查和预处理
    console.log(chalk.blue('正在检查文件...'))
    // 将相对路径转换为绝对路径进行验证
    const absoluteFilePaths = files.map(file => {
        try {
            // 如果 source 是单个文件，直接使用 source 的绝对路径
            if (!fs.statSync(args.source).isDirectory()) {
                return path.resolve(args.source)
            }
            // 如果 source 是目录，则拼接相对路径
            return path.resolve(args.source, file)
        } catch (error) {
            console.error(chalk.red(`无法访问文件 ${file}: ${error.message}`))
            return null
        }
    }).filter(Boolean)
    const validation = validateFiles(absoluteFilePaths, {
        maxSize: 500 * 1024 * 1024, // 最大500MB
        forbiddenExtensions: ['.exe', '.bat', '.cmd', '.scr', '.msi', '.dmg']
    })
    
    if (validation.invalid.length > 0) {
        console.log(chalk.red(`\n发现 ${validation.invalid.length} 个无效文件:`))
        validation.invalid.forEach((file, index) => {
            // 显示相对路径，更友好
            let displayPath
            if (!fs.statSync(args.source).isDirectory()) {
                displayPath = path.basename(file.path)
            } else {
                displayPath = path.relative(args.source, file.path)
            }
            console.log(chalk.red(`  ${index + 1}. ${displayPath}`))
            console.log(chalk.gray(`     错误: ${file.error}`))
        })
        
        if (validation.valid.length === 0) {
            console.log(chalk.red('\n没有有效文件可以上传'))
            process.exit(1)
        }
        
        console.log(chalk.yellow(`\n将跳过无效文件，继续上传 ${validation.valid.length} 个有效文件`))
    }
    
    // 将验证通过的绝对路径转换回相对路径用于上传
    const validFiles = validation.valid.map(f => {
        // 如果 source 是单个文件，返回文件名
        if (!fs.statSync(args.source).isDirectory()) {
            return path.basename(f.path)
        }
        // 如果 source 是目录，返回相对路径并转换为posix格式
        const relativePath = path.relative(args.source, f.path)
        // 将Windows反斜线转换为正斜线
        return relativePath.replace(/\\/g, '/')
    })
    console.log(chalk.green(`文件检查完成: ${validFiles.length} 个文件有效，总大小: ${validation.summary.totalSizeMB}MB`))

    // 创建共享的OSS客户端实例并测试连接
    console.log(chalk.blue('正在连接OSS服务...'))
    const ossClient = getOssClient(args)
    
    // 测试OSS连接
    try {
        await ossClient.getBucketInfo()
        console.log(chalk.green('OSS连接成功'))
    } catch (error) {
        console.error(chalk.red('OSS连接失败:'))
        console.error(chalk.red(error.message))
        if (error.code === 'NoSuchBucket') {
            console.error(chalk.yellow('提示: 请检查Bucket名称和Region配置是否正确'))
        } else if (error.code === 'InvalidAccessKeyId' || error.code === 'SignatureDoesNotMatch') {
            console.error(chalk.yellow('提示: 请检查AccessKeyId和AccessKeySecret是否正确'))
        }
        process.exit(1)
    }
    
    const tasks = validFiles.map(filename => createUploadTask(filename, args, ossClient))
    const maxConcurrency = Math.min(5, validFiles.length)  // 最大并发数为5或文件总数

    console.log(chalk.blue(`开始上传 ${validFiles.length} 个文件，最大并发数: ${maxConcurrency}`))
    
    // 创建进度条
    const progressBar = new cliProgress.SingleBar({
        format: chalk.cyan('上传进度') + ' |{bar}| {percentage}% | {value}/{total} 文件 | 速度: {speed} 文件/秒 | ETA: {eta}s',
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true
    })
    
    progressBar.start(validFiles.length, 0, { speed: '0.0' })
    
    const startTime = Date.now()
    let completedCount = 0
    
    const onProgress = (completed, total, result) => {
        completedCount = completed
        const elapsed = (Date.now() - startTime) / 1000
        const speed = elapsed > 0 ? (completed / elapsed).toFixed(1) : '0.0'
        progressBar.update(completed, { speed })
    }
    
    const results = await limitConcurrency(tasks, maxConcurrency, onProgress)
    
    progressBar.stop()
    
    // 统计上传结果
    const successFiles = results.filter(result => result && result.success)
    const failedFiles = results.filter(result => !result || !result.success)
    
    console.log(chalk.green(`\n上传完成! 成功: ${successFiles.length}/${validFiles.length}`))
    
    if (failedFiles.length > 0) {
        console.log(chalk.red(`失败: ${failedFiles.length}/${validFiles.length}`))
        
        // 按错误类型分组
        const errorGroups = {}
        failedFiles.forEach((result, index) => {
            const filename = validFiles[results.indexOf(result)]
            const errorInfo = classifyError(new Error(result?.error || '未知错误'))
            
            if (!errorGroups[errorInfo.type]) {
                errorGroups[errorInfo.type] = {
                    description: errorInfo.description,
                    suggestion: errorInfo.suggestion,
                    files: []
                }
            }
            errorGroups[errorInfo.type].files.push({
                filename,
                error: result?.error || '未知错误'
            })
        })
        
        console.log(chalk.red('\n失败文件详情:'))
        Object.entries(errorGroups).forEach(([type, group]) => {
            console.log(chalk.yellow(`\n${group.description} (${group.files.length}个文件):`))
            console.log(chalk.gray(`  建议: ${group.suggestion}`))
            group.files.forEach((file, index) => {
                console.log(chalk.red(`  ${index + 1}. ${file.filename}`))
                console.log(chalk.gray(`     错误: ${file.error}`))
            })
        })
        
        process.exit(1)
    }
    } catch (error) {
        console.error(chalk.red('程序执行出错:'))
        console.error(chalk.red(error.message))
        if (process.env.NODE_ENV === 'development') {
            console.error(chalk.gray(error.stack))
        }
        process.exit(1)
    }
}
