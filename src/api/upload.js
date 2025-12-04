// API 基础路径（可以在 .env 文件中配置 VUE_APP_API_BASE_URL）
const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || ''

/**
 * 获取已上传的切片列表
 * @param {string} hash - 文件的 hash 值
 * @returns {Promise<Array<string>>} - 已上传的切片文件名列表
 */
export function getUploadedChunks(hash) {
  return fetch(`${API_BASE_URL}/api/upload/chunks?hash=${hash}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      return res.json()
    })
    .then(data => data.chunks || [])
    .catch(err => {
      console.error('获取已上传切片列表失败:', err)
      return []
    })
}

/**
 * 上传单个切片
 * @param {FormData} formData - 包含切片数据的 FormData
 * @param {Function} onProgress - 上传进度回调函数
 * @returns {Promise} - 上传结果
 */
export function uploadChunk(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    // 监听上传进度
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded * 100) / e.total)
        onProgress(percent)
      }
    })
    
    // 监听上传完成
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = xhr.responseText ? JSON.parse(xhr.responseText) : {}
          resolve(response)
        } catch (e) {
          resolve({})
        }
      } else {
        reject(new Error(`上传失败: ${xhr.statusText}`))
      }
    })
    
    // 监听上传错误
    xhr.addEventListener('error', () => {
      reject(new Error('上传失败: 网络错误'))
    })
    
    // 监听上传中断
    xhr.addEventListener('abort', () => {
      reject(new Error('上传已取消'))
    })
    
    xhr.open('POST', `${API_BASE_URL}/api/upload/chunk`)
    xhr.send(formData)
  })
}

/**
 * 通知后端合并切片
 * @param {string} hash - 文件的 hash 值
 * @param {string} filename - 原始文件名
 * @param {number} totalChunks - 总切片数量
 * @returns {Promise} - 合并结果
 */
export function mergeChunks(hash, filename, totalChunks) {
  return fetch(`${API_BASE_URL}/api/upload/merge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ hash, filename, totalChunks })
  })
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      return res.json()
    })
    .catch(err => {
      console.error('合并切片失败:', err)
      throw err
    })
}

