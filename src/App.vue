<template>
  <div id="app">
    <ThreeMap/>
  </div>
</template>

<script>
import ThreeMap from './views/threeMap/index.vue'
export default {
  components:{
    ThreeMap
  }
}
</script>
<style>
html,
body,
#app,
.is-full {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

</style>
