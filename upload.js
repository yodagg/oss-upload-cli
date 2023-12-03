import oss from 'ali-oss'
import path from 'path'
import { getAllFilePaths, chunkArray } from './utils/index.js'

const getOssClient = (args) =>{
    return new oss({
        region: args.region,
        accessKeyId: args.accessKeyId,
        accessKeySecret: args.accessKeySecret,
        bucket: args.bucket,
    })
}

const getUploadTasks = (chunks, args) => {
    const client = getOssClient(args)

    return chunks.map(chunk => () => {
        return Promise.all(
            chunk.map(async filename => {
                const localPath = path.resolve(args.source, filename);
                const remotePath = path.join(args.target, filename);
                try {
                    const { url } = await client.put(remotePath, localPath);    
                    console.log('上传成功 ', url)
                } catch (error) {
                    console.log('上传失败 ', remotePath)
                }
            })
        )
    })
}


export default async (args) => {
    const files = getAllFilePaths(args.source)
    const chunks = chunkArray(files, 20)
    const tasks = getUploadTasks(chunks, args)

    for (const task of tasks) await task()
}
