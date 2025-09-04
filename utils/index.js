import fs from 'fs'
import path from 'path'

const isDirectory = (path) => {
  return fs.statSync(path).isDirectory()
}

const readDirectory = (dir) => {
  return fs.readdirSync(dir)
}

const getRelativePath = (dir, file) => {
  return path.join(dir, file)
}

/**
 * 获取路径下所有文件路径
 */
export const getAllFilePaths = (sourcePath, relativePath = '') => {
  const filePaths = []

  if (isDirectory(sourcePath)) {
    const files = readDirectory(sourcePath)
    files.forEach(file => {
      const filePath = path.join(sourcePath, file)
      if (isDirectory(filePath)) {
        const subDir = getRelativePath(relativePath, file)
        filePaths.push(...getAllFilePaths(filePath, subDir))
      } else {
        const filePathRelativeToDir = getRelativePath(relativePath, file)
        filePaths.push(filePathRelativeToDir)
      }
    })
  } else {
    // 处理单个文件的情况
    const fileName = path.basename(sourcePath)
    filePaths.push(relativePath || fileName)
  }
  
  return filePaths
}

/**
 * 延迟函数
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 根据错误类型获取重试策略
 * @param {Error} error - 错误对象
 * @returns {Object} - 重试策略配置
 */
const getRetryStrategy = (error) => {
  const errorInfo = classifyError(error)

  switch (errorInfo.type) {
    case 'network':
      return { maxRetries: 5, baseDelay: 2000, maxDelay: 60000 }
    case 'server':
      return { maxRetries: 3, baseDelay: 5000, maxDelay: 30000 }
    case 'permission':
      return { maxRetries: 1, baseDelay: 1000, maxDelay: 1000 }
    case 'file':
      return { maxRetries: 0, baseDelay: 0, maxDelay: 0 }
    default:
      return { maxRetries: 3, baseDelay: 1000, maxDelay: 30000 }
  }
}

/**
 * 重试逻辑函数，支持指数退避策略和智能重试策略
 * @param {Function} fn - 需要重试的异步函数
 * @param {number} maxRetries - 最大重试次数
 * @param {number} baseDelay - 基础延迟时间(毫秒)
 * @param {number} maxDelay - 最大延迟时间(毫秒)
 * @param {boolean} useSmartRetry - 是否使用智能重试策略
 * @returns {Promise} - 返回执行结果
 */
export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000, maxDelay = 30000, useSmartRetry = true) => {
  let lastError
  let currentMaxRetries = maxRetries
  let currentBaseDelay = baseDelay
  let currentMaxDelay = maxDelay
  
  for (let attempt = 0; attempt <= currentMaxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // 如果启用智能重试策略，根据错误类型调整重试参数
      if (useSmartRetry && attempt === 0) {
        const strategy = getRetryStrategy(error)
        currentMaxRetries = strategy.maxRetries
        currentBaseDelay = strategy.baseDelay
        currentMaxDelay = strategy.maxDelay
      }
      
      // 如果是最后一次尝试，直接抛出错误
      if (attempt === currentMaxRetries) {
        throw lastError
      }
      
      // 计算延迟时间，使用指数退避策略
      const delayTime = Math.min(currentBaseDelay * Math.pow(2, attempt), currentMaxDelay)
      
      // 添加随机抖动，避免雷群效应
      const jitter = Math.random() * 0.1 * delayTime
      const finalDelay = delayTime + jitter
      
      await delay(finalDelay)
    }
  }
  
  throw lastError
}

/**
 * 并发控制函数，限制同时执行的Promise数量
 * @param {Array} tasks - 任务数组，每个任务是一个返回Promise的函数
 * @param {number} concurrency - 最大并发数
 * @param {Function} onProgress - 进度回调函数
 * @returns {Promise<Array>} - 所有任务的结果数组
 */
export const limitConcurrency = async (tasks, concurrency = 5, onProgress = null) => {
  const results = new Array(tasks.length)
  let completed = 0
  let index = 0
  
  const executeTask = async (taskIndex) => {
    try {
      const result = await tasks[taskIndex]()
      results[taskIndex] = result
      completed++
      if (onProgress) {
        onProgress(completed, tasks.length, result)
      }
      return result
    } catch (error) {
      const errorResult = { success: false, error: error.message }
      results[taskIndex] = errorResult
      completed++
      if (onProgress) {
        onProgress(completed, tasks.length, errorResult)
      }
      return errorResult
    }
  }
  
  const worker = async () => {
    while (index < tasks.length) {
      const taskIndex = index++
      await executeTask(taskIndex)
    }
  }
  
  // 创建并发工作者
  const workers = []
  const workerCount = Math.min(concurrency, tasks.length)
  
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker())
  }
  
  // 等待所有工作者完成
  await Promise.all(workers)
  
  return results
}

/**
 * 错误分类函数，根据错误信息判断错误类型
 * @param {Error} error - 错误对象
 * @returns {Object} - 包含错误类型和描述的对象
 */
export const classifyError = (error) => {
  const errorMessage = error.message || error.toString()
  const errorCode = error.code || error.status
  
  // 网络相关错误
  if (errorMessage.includes('ENOTFOUND') || 
      errorMessage.includes('ECONNREFUSED') || 
      errorMessage.includes('ETIMEDOUT') || 
      errorMessage.includes('timeout') ||
      errorCode === 'NetworkingError') {
    return {
      type: 'network',
      description: '网络连接错误',
      suggestion: '请检查网络连接或稍后重试'
    }
  }
  
  // 权限相关错误
  if (errorCode === 403 || 
      errorMessage.includes('AccessDenied') ||
      errorMessage.includes('Forbidden') ||
      errorMessage.includes('InvalidAccessKeyId')) {
    return {
      type: 'permission',
      description: '权限验证失败',
      suggestion: '请检查AccessKey、SecretKey和Bucket权限配置'
    }
  }
  
  // 文件相关错误
  if (errorMessage.includes('ENOENT') ||
      errorMessage.includes('no such file') ||
      errorCode === 'NoSuchKey') {
    return {
      type: 'file',
      description: '文件不存在',
      suggestion: '请检查文件路径是否正确'
    }
  }
  
  // OSS服务相关错误
  if (errorCode === 'NoSuchBucket') {
    return {
      type: 'oss',
      description: 'Bucket不存在',
      suggestion: '请检查Bucket名称和Region配置'
    }
  }
  
  if (errorCode >= 500) {
    return {
      type: 'server',
      description: '服务器内部错误',
      suggestion: '服务器暂时不可用，请稍后重试'
    }
  }
  
  // 默认未知错误
  return {
    type: 'unknown',
    description: '未知错误',
    suggestion: '请查看详细错误信息或联系技术支持'
  }
}

/**
 * 文件检查和预处理函数
 * @param {string} filePath - 文件路径
 * @param {Object} options - 检查选项
 * @returns {Object} - 检查结果
 */
export const validateFile = (filePath, options = {}) => {
  const {
    maxSize = 100 * 1024 * 1024, // 默认最大100MB
    allowedExtensions = null, // 允许的文件扩展名数组
    forbiddenExtensions = ['.exe', '.bat', '.cmd', '.scr'], // 禁止的文件扩展名
    checkReadable = true // 是否检查文件可读性
  } = options
  
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        error: '文件不存在',
        type: 'not_found'
      }
    }
    
    const stats = fs.statSync(filePath)
    
    // 检查是否为文件（非目录）
    if (!stats.isFile()) {
      return {
        valid: false,
        error: '路径不是一个文件',
        type: 'not_file'
      }
    }
    
    // 检查文件大小
    if (stats.size > maxSize) {
      return {
        valid: false,
        error: `文件大小超过限制 (${(stats.size / 1024 / 1024).toFixed(2)}MB > ${(maxSize / 1024 / 1024).toFixed(2)}MB)`,
        type: 'size_exceeded'
      }
    }
    
    // 检查文件扩展名
    const ext = path.extname(filePath).toLowerCase()
    
    if (forbiddenExtensions.includes(ext)) {
      return {
        valid: false,
        error: `禁止上传的文件类型: ${ext}`,
        type: 'forbidden_extension'
      }
    }
    
    if (allowedExtensions && !allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `不支持的文件类型: ${ext}，支持的类型: ${allowedExtensions.join(', ')}`,
        type: 'unsupported_extension'
      }
    }
    
    // 检查文件可读性
    if (checkReadable) {
      try {
        fs.accessSync(filePath, fs.constants.R_OK)
      } catch (error) {
        return {
          valid: false,
          error: '文件不可读',
          type: 'not_readable'
        }
      }
    }
    
    return {
      valid: true,
      size: stats.size,
      extension: ext,
      lastModified: stats.mtime
    }
    
  } catch (error) {
    return {
      valid: false,
      error: `文件检查失败: ${error.message}`,
      type: 'check_failed'
    }
  }
}

/**
 * 批量文件检查函数
 * @param {Array} filePaths - 文件路径数组
 * @param {Object} options - 检查选项
 * @returns {Object} - 检查结果统计
 */
export const validateFiles = (filePaths, options = {}) => {
  const results = {
    valid: [],
    invalid: [],
    totalSize: 0,
    summary: {
      total: filePaths.length,
      validCount: 0,
      invalidCount: 0,
      totalSizeMB: 0
    }
  }
  
  filePaths.forEach(filePath => {
    const validation = validateFile(filePath, options)
    
    if (validation.valid) {
      results.valid.push({
        path: filePath,
        size: validation.size,
        extension: validation.extension
      })
      results.totalSize += validation.size
      results.summary.validCount++
    } else {
      results.invalid.push({
        path: filePath,
        error: validation.error,
        type: validation.type
      })
      results.summary.invalidCount++
    }
  })
  
  results.summary.totalSizeMB = (results.totalSize / 1024 / 1024).toFixed(2)
  
  return results
}
