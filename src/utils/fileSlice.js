/**
 * 文件切片配置
 */
export const SLICE_CONFIG = {
  CHUNK_SIZE: 5 * 1024 * 1024, // 固定切片大小：5MB
  MAX_CHUNK_COUNT: 100 // 最大切片数量
}

/**
 * 计算切片大小
 * @param {number} fileSize - 文件总大小（字节）
 * @returns {number} - 计算后的切片大小（字节）
 */
export function calculateChunkSize(fileSize) {
  const { CHUNK_SIZE, MAX_CHUNK_COUNT } = SLICE_CONFIG
  
  // 如果按固定切片大小计算的切片数量超过最大数量，则重新计算切片大小
  const chunkCount = Math.ceil(fileSize / CHUNK_SIZE)
  
  if (chunkCount > MAX_CHUNK_COUNT) {
    // 使用总文件大小除以最大切片数量，确保切片数量不超过限制
    return Math.ceil(fileSize / MAX_CHUNK_COUNT)
  }
  
  return CHUNK_SIZE
}

/**
 * 将文件切片
 * @param {File} file - 要切片的文件对象
 * @param {string} hash - 文件的 hash 值
 * @returns {Array<{chunk: Blob, index: number, hash: string, filename: string}>} - 切片数组
 */
export function sliceFile(file, hash) {
  const chunkSize = calculateChunkSize(file.size)
  const chunks = []
  let currentChunk = 0
  const totalChunks = Math.ceil(file.size / chunkSize)

  while (currentChunk < totalChunks) {
    const start = currentChunk * chunkSize
    const end = start + chunkSize >= file.size ? file.size : start + chunkSize
    const chunk = file.slice(start, end)
    
    // 切片命名：hash + 数组下标
    const filename = `${hash}-${currentChunk}`
    
    chunks.push({
      chunk,
      index: currentChunk,
      hash,
      filename,
      totalChunks
    })
    
    currentChunk++
  }

  return chunks
}

