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
 * @param {string} dir
 * @param {string} relativePath 
 * @returns {string[]}
 */
export const getAllFilePaths = (dir, relativePath = '') => {
  const filePaths = []

  if (isDirectory(dir)) {
    const files = readDirectory(dir)
    files.forEach(file => {
      const filePath = path.join(dir, file)
      if (isDirectory(filePath)) {
        const subDir = getRelativePath(relativePath, file)
        filePaths.push(...getAllFilePaths(filePath, subDir))
      } else {
        const filePathRelativeToDir = getRelativePath(relativePath, file)
        filePaths.push(filePathRelativeToDir)
      }
    })
  } else {
    filePaths.push(relativePath)
  }

  return filePaths
}


/**
 * 数组切块
 * @param {any[]} arr
 * @param {number} size
 * @returns {any[][]}
 */
export const chunkArray = (arr, size) => {
    const result = [];
    let index = 0;
    while (index < arr.length) {
      result.push(arr.slice(index, index + size));
      index += size;
    }
    return result;
}
