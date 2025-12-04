import SparkMD5 from 'spark-md5'

/**
 * 计算文件的 MD5 hash 值
 * @param {File} file - 要计算 hash 的文件对象
 * @returns {Promise<string>} - 返回文件的 hash 值
 */
export function calculateFileHash(file) {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer()
    const fileReader = new FileReader()
    const chunkSize = 2 * 1024 * 1024 // 2MB 分片读取，避免一次性读取大文件导致内存溢出
    let currentChunk = 0
    const chunks = Math.ceil(file.size / chunkSize)

    fileReader.onload = (e) => {
      spark.append(e.target.result)
      currentChunk++

      if (currentChunk < chunks) {
        loadNext()
      } else {
        const hash = spark.end()
        resolve(hash)
      }
    }

    fileReader.onerror = () => {
      reject(new Error('文件读取失败'))
    }

    const loadNext = () => {
      const start = currentChunk * chunkSize
      const end = start + chunkSize >= file.size ? file.size : start + chunkSize
      fileReader.readAsArrayBuffer(file.slice(start, end))
    }

    loadNext()
  })
}

