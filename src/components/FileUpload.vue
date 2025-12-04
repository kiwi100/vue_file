<template>
  <div class="file-upload">
    <div class="upload-container">
      <input
        ref="fileInput"
        type="file"
        class="file-input"
        @change="handleFileSelect"
        :disabled="isUploading"
      />
      <div class="upload-area" @click="triggerFileSelect">
        <div v-if="!selectedFile" class="upload-placeholder">
          <p>点击选择文件或拖拽文件到此处</p>
          <p class="upload-hint">支持大文件上传，自动切片和断点续传</p>
        </div>
        <div v-else class="file-info">
          <p class="file-name">{{ selectedFile.name }}</p>
          <p class="file-size">{{ formatFileSize(selectedFile.size) }}</p>
        </div>
      </div>

      <div v-if="selectedFile" class="upload-actions">
        <button
          v-if="!isUploading && !isCalculating"
          @click="startUpload"
          class="btn btn-primary"
        >
          开始上传
        </button>
        <button
          v-if="isUploading && !isPaused"
          @click="pauseUpload"
          class="btn btn-warning"
        >
          暂停
        </button>
        <button
          v-if="isUploading && isPaused"
          @click="resumeUpload"
          class="btn btn-primary"
        >
          继续
        </button>
        <button
          v-if="isUploading"
          @click="cancelUpload"
          class="btn btn-danger"
        >
          取消
        </button>
        <button
          v-if="!isUploading"
          @click="resetUpload"
          class="btn btn-secondary"
        >
          重新选择
        </button>
      </div>

      <div v-if="isCalculating" class="status-info">
        <p>正在计算文件 hash...</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 100%; animation: pulse 1.5s ease-in-out infinite;"></div>
        </div>
      </div>

      <div v-if="uploadProgress.total > 0" class="upload-progress">
        <div class="progress-info">
          <span>上传进度: {{ uploadProgress.uploaded }} / {{ uploadProgress.total }}</span>
          <span>{{ uploadProgress.percent }}%</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: uploadProgress.percent + '%' }"
          ></div>
        </div>
        <div v-if="uploadInfo" class="upload-details">
          <p>文件 Hash: {{ uploadInfo.hash }}</p>
          <p>已上传切片: {{ uploadInfo.uploadedChunks }} / {{ uploadInfo.totalChunks }}</p>
        </div>
      </div>

      <div v-if="uploadStatus" class="status-message" :class="uploadStatus.type">
        <p>{{ uploadStatus.message }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { BigFileUploader } from '../utils/upload'

export default {
  name: 'FileUpload',
  data() {
    return {
      selectedFile: null,
      isUploading: false,
      isPaused: false,
      isCalculating: false,
      uploadProgress: {
        uploaded: 0,
        total: 0,
        percent: 0
      },
      uploadInfo: null,
      uploadStatus: null,
      uploader: null
    }
  },
  methods: {
    /**
     * 触发文件选择
     */
    triggerFileSelect() {
      if (!this.isUploading) {
        this.$refs.fileInput.click()
      }
    },

    /**
     * 处理文件选择
     */
    handleFileSelect(event) {
      const file = event.target.files[0]
      if (!file) return

      this.selectedFile = file
      this.resetUploadState()
    },

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
    },

    /**
     * 开始上传
     */
    async startUpload() {
      if (!this.selectedFile) {
        this.showStatus('error', '请先选择文件')
        return
      }

      this.isUploading = true
      this.isCalculating = true
      this.uploadStatus = null

      try {
        // 创建上传器实例
        this.uploader = new BigFileUploader({
          onProgress: (progress) => {
            this.uploadProgress = {
              uploaded: progress.uploaded,
              total: progress.total,
              percent: progress.percent
            }
          },
          onChunkProgress: (chunkProgress) => {
            // 单个切片上传进度（可选，用于更详细的进度显示）
            console.log(`切片 ${chunkProgress.index} 上传进度: ${chunkProgress.percent}%`)
          },
          onSuccess: (result) => {
            this.isUploading = false
            this.isCalculating = false
            this.showStatus('success', `文件上传成功！Hash: ${result.hash}`)
            this.uploadInfo = {
              hash: result.hash,
              filename: result.filename
            }
          },
          onError: (error) => {
            this.isUploading = false
            this.isCalculating = false
            this.showStatus('error', `上传失败: ${error.message || '未知错误'}`)
          }
        })

        this.uploader.setFile(this.selectedFile)

        // 开始上传
        await this.uploader.start()
      } catch (error) {
        this.isUploading = false
        this.isCalculating = false
        this.showStatus('error', `上传失败: ${error.message || '未知错误'}`)
      }
    },

    /**
     * 暂停上传
     */
    pauseUpload() {
      if (this.uploader) {
        this.uploader.pause()
        this.isPaused = true
        this.showStatus('info', '上传已暂停')
      }
    },

    /**
     * 继续上传
     */
    async resumeUpload() {
      if (this.uploader) {
        this.isPaused = false
        this.uploadStatus = null
        try {
          await this.uploader.resume()
        } catch (error) {
          this.showStatus('error', `继续上传失败: ${error.message || '未知错误'}`)
        }
      }
    },

    /**
     * 取消上传
     */
    cancelUpload() {
      if (this.uploader) {
        this.uploader.cancel()
        this.isUploading = false
        this.isPaused = false
        this.showStatus('info', '上传已取消')
      }
    },

    /**
     * 重置上传状态
     */
    resetUploadState() {
      this.isUploading = false
      this.isPaused = false
      this.isCalculating = false
      this.uploadProgress = {
        uploaded: 0,
        total: 0,
        percent: 0
      }
      this.uploadInfo = null
      this.uploadStatus = null
      this.uploader = null
    },

    /**
     * 重新选择文件
     */
    resetUpload() {
      this.cancelUpload()
      this.selectedFile = null
      this.$refs.fileInput.value = ''
      this.resetUploadState()
    },

    /**
     * 显示状态消息
     */
    showStatus(type, message) {
      this.uploadStatus = { type, message }
      if (type === 'success') {
        setTimeout(() => {
          this.uploadStatus = null
        }, 5000)
      }
    }
  }
}
</script>

<style scoped>
.file-upload {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.upload-container {
  background: #fff;
  border-radius: 8px;
  padding: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.file-input {
  display: none;
}

.upload-area {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 20px;
}

.upload-area:hover {
  border-color: #1890ff;
  background-color: #fafafa;
}

.upload-placeholder {
  color: #666;
}

.upload-placeholder p {
  margin: 10px 0;
}

.upload-hint {
  font-size: 12px;
  color: #999;
}

.file-info {
  text-align: left;
}

.file-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
  word-break: break-all;
}

.file-size {
  color: #666;
  font-size: 14px;
}

.upload-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-primary {
  background-color: #1890ff;
  color: #fff;
}

.btn-primary:hover {
  background-color: #40a9ff;
}

.btn-warning {
  background-color: #faad14;
  color: #fff;
}

.btn-warning:hover {
  background-color: #ffc53d;
}

.btn-danger {
  background-color: #ff4d4f;
  color: #fff;
}

.btn-danger:hover {
  background-color: #ff7875;
}

.btn-secondary {
  background-color: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background-color: #d9d9d9;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-info {
  margin-bottom: 20px;
}

.status-info p {
  margin-bottom: 10px;
  color: #666;
}

.upload-progress {
  margin-bottom: 20px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background-color: #1890ff;
  transition: width 0.3s;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.upload-details {
  margin-top: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
}

.upload-details p {
  margin: 5px 0;
  word-break: break-all;
}

.status-message {
  padding: 12px;
  border-radius: 4px;
  margin-top: 20px;
}

.status-message.success {
  background-color: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #52c41a;
}

.status-message.error {
  background-color: #fff2f0;
  border: 1px solid #ffccc7;
  color: #ff4d4f;
}

.status-message.info {
  background-color: #e6f7ff;
  border: 1px solid #91d5ff;
  color: #1890ff;
}

.status-message p {
  margin: 0;
}
</style>

