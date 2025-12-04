<template>
  <div id="app">
    <h1>大文件上传</h1>
    <FileUpload />
  </div>
</template>

<script>
import FileUpload from './components/FileUpload.vue'

export default {
  name: 'App',
  components: {
    FileUpload
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin-top: 20px;
}

h1 {
  text-align: center;
  margin-bottom: 30px;
}
</style>
