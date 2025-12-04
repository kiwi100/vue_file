import { calculateFileHash } from './hash'
import { sliceFile } from './fileSlice'
import { getUploadedChunks, uploadChunk, mergeChunks } from '../api/upload'

/**
 * 大文件上传类
 */
export class BigFileUploader {
  constructor(options = {}) {
    this.options = {
      onProgress: options.onProgress || (() => {}), // 总进度回调
      onChunkProgress: options.onChunkProgress || (() => {}), // 单个切片进度回调
      onSuccess: options.onSuccess || (() => {}), // 成功回调
      onError: options.onError || (() => {}), // 错误回调
      concurrent: options.concurrent || 3 // 并发上传数量
    }
    this.file = null
    this.hash = null
    this.chunks = []
    this.uploadedChunks = []
    this.isUploading = false
    this.isPaused = false
  }

  /**
   * 设置要上传的文件
   * @param {File} file - 文件对象
   */
  setFile(file) {
    this.file = file
  }

  /**
   * 计算文件 hash
   * @returns {Promise<string>}
   */
  async calculateHash() {
    if (!this.file) {
      throw new Error('请先选择文件')
    }
    
    this.hash = await calculateFileHash(this.file)
    return this.hash
  }

  /**
   * 准备上传（计算 hash 和切片）
   * @returns {Promise<void>}
   */
  async prepare() {
    if (!this.file) {
      throw new Error('请先选择文件')
    }

    // 计算文件 hash
    if (!this.hash) {
      await this.calculateHash()
    }

    // 切片文件
    this.chunks = sliceFile(this.file, this.hash)

    // 获取已上传的切片列表
    const uploadedChunkNames = await getUploadedChunks(this.hash)
    this.uploadedChunks = uploadedChunkNames

    // 过滤掉已上传的切片（断点续传）
    this.chunks = this.chunks.filter(chunk => {
      return !uploadedChunkNames.includes(chunk.filename)
    })

    return {
      hash: this.hash,
      totalChunks: this.chunks.length + this.uploadedChunks.length,
      uploadedChunks: this.uploadedChunks.length,
      remainingChunks: this.chunks.length
    }
  }

  /**
   * 上传单个切片
   * @param {Object} chunkInfo - 切片信息
   * @returns {Promise}
   */
  async uploadSingleChunk(chunkInfo) {
    const { chunk, filename, hash, index, totalChunks } = chunkInfo

    // 转换为 FormData
    const formData = new FormData()
    formData.append('chunk', chunk)
    formData.append('hash', hash)
    formData.append('filename', filename)
    formData.append('index', index)
    formData.append('totalChunks', totalChunks)

    // 上传切片
    return uploadChunk(formData, (percent) => {
      this.options.onChunkProgress({
        index,
        filename,
        percent
      })
    })
  }

  /**
   * 并发上传切片
   * @returns {Promise<void>}
   */
  async uploadChunks() {
    if (this.chunks.length === 0) {
      return
    }

    const { concurrent } = this.options
    const chunks = [...this.chunks]
    const uploading = []

    const uploadNext = async () => {
      if (this.isPaused) {
        return
      }

      if (chunks.length === 0 && uploading.length === 0) {
        return
      }

      if (uploading.length >= concurrent || chunks.length === 0) {
        return
      }

      const chunkInfo = chunks.shift()
      const uploadPromise = this.uploadSingleChunk(chunkInfo)
        .then(() => {
          this.uploadedChunks.push(chunkInfo.filename)
          
          // 更新总进度
          const totalProgress = Math.round(
            ((this.uploadedChunks.length) / (this.chunks.length + this.uploadedChunks.length)) * 100
          )
          this.options.onProgress({
            uploaded: this.uploadedChunks.length,
            total: this.chunks.length + this.uploadedChunks.length,
            percent: totalProgress
          })

          // 从上传队列中移除
          const index = uploading.indexOf(uploadPromise)
          if (index > -1) {
            uploading.splice(index, 1)
          }

          // 继续上传下一个
          return uploadNext()
        })
        .catch(() => {
          // 上传失败，将切片重新加入队列
          chunks.unshift(chunkInfo)
          
          const index = uploading.indexOf(uploadPromise)
          if (index > -1) {
            uploading.splice(index, 1)
          }

          // 如果是因为暂停导致的错误，不继续上传
          if (!this.isPaused) {
            return uploadNext()
          }
        })

      uploading.push(uploadPromise)
      await uploadNext()
    }

    // 启动并发上传
    const promises = []
    for (let i = 0; i < Math.min(concurrent, chunks.length); i++) {
      promises.push(uploadNext())
    }

    await Promise.all(promises)
  }

  /**
   * 开始上传
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isUploading) {
      throw new Error('文件正在上传中')
    }

    if (!this.file) {
      throw new Error('请先选择文件')
    }

    this.isUploading = true
    this.isPaused = false

    try {
      // 准备上传（计算 hash、切片、获取已上传列表）
      await this.prepare()

      // 上传所有切片
      await this.uploadChunks()

      // 所有切片上传完成，通知后端合并
      await mergeChunks(this.hash, this.file.name, this.chunks.length + this.uploadedChunks.length)

      this.options.onSuccess({
        hash: this.hash,
        filename: this.file.name
      })
    } catch (error) {
      this.options.onError(error)
      throw error
    } finally {
      this.isUploading = false
    }
  }

  /**
   * 暂停上传
   */
  pause() {
    this.isPaused = true
  }

  /**
   * 继续上传
   */
  async resume() {
    if (!this.isUploading) {
      return
    }
    
    this.isPaused = false
    await this.uploadChunks()
  }

  /**
   * 取消上传
   */
  cancel() {
    this.isPaused = true
    this.isUploading = false
    this.chunks = []
    this.uploadedChunks = []
  }
}

