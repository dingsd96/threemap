<template>
  <div id="three-map" class="is-full"></div>
</template>

<script>
// three 典型树形数据结构
import BaseEarth from '@/utils/Earth.js';
import TWEEN from '@tweenjs/tween.js';
import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { onBeforeUnmount, onMounted } from 'vue';
import useFileLoader from '@/hooks/useFileLoader.js';
import useCountry from '@/hooks/useCountry.js';
import useCoord from '@/hooks/useCoord.js';
import useConversionStandardData from '@/hooks/useConversionStandardData.js';
import useMapMarkedLightPillar from '@/hooks/map/useMapMarkedLightPillar';
import useSequenceFrameAnimate from '@/hooks/useSequenceFrameAnimate';
import useCSS2DRender from '@/hooks/useCSS2DRender';
import { random, lon2xyz } from '@/utils';
import { getTifConvertImage, lonlatToMercator, lonlatToThree, customEaseIn } from "@/utils/utils";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader"

const clock = new THREE.Clock();
let centerXY = [116.44902420043945, 27.49795913696289];

export default {
  name: '3dMap30',
  setup() {
    let baseEarth = null;
    const resize = () => {
      baseEarth.resize();
    };
    const { requestData } = useFileLoader();
    const { transfromGeoJSON } = useConversionStandardData();
    const { getBoundingBox } = useCoord();
    const { createCountryFlatLine } = useCountry();
    const { initCSS2DRender, create2DTag } = useCSS2DRender();
    const { createLightPillar } = useMapMarkedLightPillar({
      scaleFactor: 1.2,
    });
    const { createSequenceFrame } = useSequenceFrameAnimate();
    const texture = new THREE.TextureLoader()
    const rotatingApertureTexture = texture.load('/data/map/rotatingAperture.png')
    const rotatingPointTexture = texture.load('/data/map/rotating-point2.png')
    const circlePoint = texture.load('/data/map/circle-point.png')
    const sceneBg = texture.load('/data/map/scene-bg2.png')
    const lineTexture = texture.load('/data/time-line.png')
    const bottomZ = -0.2;
    const guiParams = {
      topColor: '#ffffff',
      // topColor: '#7af09d',
      scaleX: 0.09,
      scaleY: 0.09,
      centerX: 0.10,
      centerY: 0.066,
      rotation: 345,
      sideColor: '#123024',
      combine: "Multiply",// 混合模式
      transparent: true,  // 是否透明
      opacity: 1, // 透明度
      depth: 0.1,
      bevelThickness: 0.2,
    };
    let textureMap, topFaceMaterial, sideMaterial
    const initMaterial = async () => {
      // 序列帧
      textureMap = texture.load('/data/gz.png');
      // 根据法向向量计算物体表面的颜色
      // const textureNormal = texture.load('/data/map/gz-map-fx.jpg');
      // const texturefxMap = texture.load('/data/map/alphaMap.jpg');
      textureMap.wrapS = textureMap.wrapT = THREE.RepeatWrapping;
      // = THREE.RepeatWrapping;
      textureMap.repeat.set(guiParams.scaleX, guiParams.scaleY);
      textureMap.center.set(guiParams.centerX, guiParams.centerY);
      // 接收光的材质，没有光源者不显示
      // 该材料使用非基于物理的Blinn-Phong模型来计算反射系数
      // 高光的闪亮表面（如漆木）
      topFaceMaterial = new THREE.MeshPhongMaterial({
        map: textureMap,
        color: guiParams.topColor, // 确保材质的color属性不会影响贴图颜色
        ambientColor:guiParams.topColor, // 设置环境光颜色为白色
        specularColor: guiParams.topColor, // 设置镜面反射颜色为白色
        shininess: 0,                      // 设置高光锐利度为0
        opacity: 1,                        // 设置不透明度为1
        transparent: false,                // 设置材质为不透明
        envMap: null,                      // 禁用反射贴图
        metalness: 0,                      // 禁用金属感
        roughness: 1                       // 设置粗糙度为1，这将禁用SBR


        // 法线贴图
        //设置深浅程度，默认值(1,1)。
        // color: guiParams.topColor,
        // normalScale: new THREE.Vector2(1.2, 1.2),
        // combine: THREE.MultiplyOperation,
        // transparent: false,// 是否透明
        // opacity: guiParams.opacity,  // 透明度
      });
      sideMaterial = new THREE.MeshLambertMaterial({
        color: guiParams.sideColor, // 地图高度的颜色
        transparent: false, // 是否透明
        opacity: 0.8, // 透明度
      });
    }
    // 初始化gui
    const initGui = () => {
      const gui = new GUI();
      // 贴图比例
      gui.add(guiParams, 'scaleX', 0, 0.3).onChange((val) => {
        textureMap.repeat.set(val, textureMap.repeat.y);
      });
      gui.add(guiParams, 'scaleY', 0, 0.3).onChange((val) => {
        textureMap.repeat.set(textureMap.repeat.x, val);
      });
      gui.add(guiParams, 'centerX', -1, 1).onChange((val) => {
        textureMap.center.set(val, textureMap.center.y);
      });
      gui.add(guiParams, 'centerY', -1, 1).onChange((val) => {
        textureMap.center.set(textureMap.center.x, val);
      });
      gui.add(guiParams, 'rotation', 0, 360).onChange((val) => {
        textureMap.rotation = val * (Math.PI / 180);
        // textureMap.rotation = val*(180/Math.PI);
      });


      // 材质1变化的影响
      const folder = gui.addFolder("地图面材质");
      folder.addColor(guiParams, "topColor").onChange((e) => {
        topFaceMaterial.color = new THREE.Color(e);
      });
      folder.addColor(guiParams, "sideColor").onChange((e) => {
        sideMaterial.color = new THREE.Color(e);
      });
      folder.add(guiParams, "combine", ["Multiply", "Mix", "Add"]).onChange((e) => {
        switch (e) {
          case "Multiply":
            topFaceMaterial.combine = THREE.MultiplyOperation;
            break;
          case "Mix":
            topFaceMaterial.combine = THREE.MixOperation;
            break;
          case "Add":
            topFaceMaterial.combine = THREE.AddOperation;
            break;
          default:
            break;
        }
        topFaceMaterial.needsUpdate = true;
      });
      folder.add(guiParams, "transparent").onChange((e) => {
        topFaceMaterial.transparent = new THREE.Color(e);
      });
      folder.add(guiParams, "opacity", 0, 1).onChange((e) => {
        topFaceMaterial.opacity = e;
      });
      // 材质2 sideMaterial

    };
    // 初始化旋转光圈
    const initRotatingAperture = (scene, width) => {
      let plane = new THREE.PlaneBufferGeometry(width, width);
      let material = new THREE.MeshBasicMaterial({
        map: rotatingApertureTexture,
        transparent: true,
        opacity: 1,
        depthTest: true,
      });
      let mesh = new THREE.Mesh(plane, material);
      mesh.position.set(...centerXY, 0);
      mesh.scale.set(1.1, 1.1, 1.1);
      scene.add(mesh);
      return mesh;
    };
    // 初始化旋转点
    const initRotatingPoint = (scene, width) => {
      let plane = new THREE.PlaneBufferGeometry(width, width);
      let material = new THREE.MeshBasicMaterial({
        map: rotatingPointTexture,
        transparent: true,
        opacity: 1,
        depthTest: true,
      });
      let mesh = new THREE.Mesh(plane, material);
      mesh.position.set(...centerXY, bottomZ - 0.02);
      mesh.scale.set(1.1, 1.1, 1.1);
      scene.add(mesh);
      return mesh;
    };
    // 初始化背景
    const initSceneBg = (scene, width) => {
      let plane = new THREE.PlaneBufferGeometry(width * 4, width * 4);
      let material = new THREE.MeshPhongMaterial({
        // color: 0x061920,
        color: 0xffffff,
        map: sceneBg,
        transparent: true,
        opacity: 1,
        depthTest: true,
      });
      let mesh = new THREE.Mesh(plane, material);
      mesh.position.set(...centerXY, bottomZ - 0.2);
      scene.add(mesh);
    };
    // 初始化原点
    const initCirclePoint = (scene, width) => {
      let plane = new THREE.PlaneBufferGeometry(width, width);
      let material = new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        map: circlePoint,
        transparent: true,
        opacity: 1,
        // depthTest: false,
      });
      let mesh = new THREE.Mesh(plane, material);
      mesh.position.set(...centerXY, bottomZ - 0.1);
      // let mesh2 = mesh.clone()
      // mesh2.position.set(...centerXY, bottomZ - 0.001)
      scene.add(mesh);
    };
    // 初始化粒子
    const initParticle = (scene, bound) => {
      // 获取中心点和中间地图大小
      let { center, size } = bound;
      // 构建范围，中间地图的2倍
      let minX = center.x - size.x;
      let maxX = center.x + size.x;
      let minY = center.y - size.y;
      let maxY = center.y + size.y;
      let minZ = -6;
      let maxZ = 6;

      let particleArr = [];
      for (let i = 0; i < 16; i++) {
        const particle = createSequenceFrame({
          image: './data/map/上升粒子1.png',
          width: 180,
          height: 189,
          frame: 9,
          column: 9,
          row: 1,
          speed: 0.5,
        });
        let particleScale = random(5, 10) / 1000;
        particle.scale.set(particleScale, particleScale, particleScale);
        particle.rotation.x = Math.PI / 2;
        let x = random(minX, maxX);
        let y = random(minY, maxY);
        let z = random(minZ, maxZ);
        particle.position.set(x, y, z);
        particleArr.push(particle);
      }
      scene.add(...particleArr);
      return particleArr;
    };
    // 创建顶部底部边线
    const initBorderLine = (data, mapGroup, scene, gauge) => {
      let lineTop = createCountryFlatLine(
          data,
          {
            color: 0xffffff,
            linewidth: 0.0009,
            transparent: true,
            depthTest: false,
          },
          'Line2'
      );
      lineTop.position.z += gauge;
      let lineBottom = createCountryFlatLine(
          data,
          {
            color: 0x61fbfd,
            linewidth: 0.002,
            // transparent: true,
            depthTest: false,
          },
          'Line2'
      );
      lineBottom.position.z -= 0.1905;
      //  添加边线
      mapGroup.add(lineTop);
      // mapGroup.add(lineBottom); // 底部的线
    };
    // 创建光柱
    const initLightPoint = (properties, mapGroup, gauge = '0.31') => {
      if (!properties.centroid && !properties.center) {
        return false;
      }
      // 创建光柱
      let heightScaleFactor = 0.4 + random(1, 5) / 5;
      let lightCenter = properties.centroid || properties.center;
      let light = createLightPillar(...lightCenter, heightScaleFactor);
      light.position.z = gauge;
      mapGroup.add(light);
    };
    // 创建标签
    const initLabel = (properties, scene, gauge) => {
      if (!properties.centroid && !properties.center) {
        return false
      }
      // 设置标签的显示内容和位置
      const label = create2DTag('标签', 'map-32-label');
      scene.add(label);
      let labelCenter = properties.center; //centroid || properties.center
      label.show(properties.name, new THREE.Vector3(...labelCenter, gauge));
    };
    // 坐标转换
    const lglt2xyz = (lng, lat, radius) => {
      const theta = (90 + lng) * (Math.PI / 180)
      const phi = (90 - lat) * (Math.PI / 180)
      return (new THREE.Vector3()).setFromSpherical(new THREE.Spherical(radius, phi, theta))
    }

    // 创建五河流
    const createFiveRiver = async (scene, mapGroup, gauge) => {
      const riverData = await requestData('./data/five-rv.json');
      // lineTexture.wrapS = lineTexture.wrapT = THREE.RepeatWrapping; //每个都重复
      lineTexture.wrapS = THREE.RepeatWrapping;
      lineTexture.wrapT = THREE.RepeatWrapping;
      lineTexture.repeat.set(0.5, 0.5)
      // lineTexture.needsUpdate = true
      const tubeMat = new THREE.MeshBasicMaterial({
        map: lineTexture,
        // color:0xff4d4d,
        side: THREE.DoubleSide,
        transparent: true
      })

      const result = riverData.features
      const points = [[], [], [], [], []]
      result.forEach((v, i) => {
        v.geometry.paths[0].forEach(k => {
          const [x, y] = k
          points[i].push(new THREE.Vector3(x, y, gauge))
        })
      })

      points.forEach(item => {
        const path = new THREE.CatmullRomCurve3(item)
        const tubeGeo = new THREE.TubeGeometry(path, 60, 0.03)
        const tube = new THREE.Mesh(tubeGeo, tubeMat)
        scene.add(tube)
      })

      // const lineGeo = new THREE.BufferGeometry()
      // lineGeo.setFromPoints(path)
      // const lineMat = new THREE.LineBasicMaterial({color: 0xff0000})
      // const line = new THREE.Line(lineGeo, lineMat)
      // scene.add(line)
    }

    //添加事件
    const handleEvent = (mouse) => {
      mouse.x = 1
      mouse.y = 1
      const onMouseMove = (event) => {
        // 将鼠标位置归一化为设备坐标。x 和 y 方向的取值范围是 (-1 to +1)
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
      }
      window.addEventListener('mousemove', onMouseMove, false)
    }
    let count = 0

    // 射线发放
    const raycasterEvent = (_this) => {
      if (count < 1) {
        console.log('mouse-->', _this.mouse)
        count++
      }

      // 通过摄像机和鼠标更新射线
      _this.raycaster.setFromCamera(_this.mouse, _this.camera)

      // 算出射线 与当场景相交的对象有那些
      const intersects = _this.raycaster.intersectObjects(
          _this.mapGroup.children,
          true
      )

      // 恢复上一次清空的
      if (_this.lastPick) {
        // _this.lastPick.object.material[0].color.set(guiParams.topColor)
      }

      _this.lastPick = null
      _this.lastPick = intersects.find(
          ({ object }) => object.material && object.material.length === 2 && object.parent.properties
      )

      if (_this.lastPick) {
        _this.lastPick.object.material[0].color.set(0xff0000)
      }
    }

    onMounted(async () => {
      await initMaterial()
      // 加载地图数据　
      // let provinceData = await requestData('./data/map/jxs.json');
      // let provinceData = await requestData('./data/map/gz-data.json');
      let provinceData = await requestData('./data/map/赣州市区县0.json');
      // 获取到的数据已经MultiPolygon数据类型,不需要转换
      provinceData = transfromGeoJSON(provinceData);
      class CurrentEarth extends BaseEarth {
        constructor(props) {
          super(props);
        }

        initCamera() {
          let { width, height } = this.options;
          let rate = width / height;
          // this.camera = new THREE.PerspectiveCamera(45, rate, 0.1, 90000000);
          this.camera = new THREE.PerspectiveCamera(25, rate * 0.80, 1, 90000000);
          //相机在Three.js坐标系中的位置,
          //TODO：如何转换坐标问题
          // this.camera.position.set(115.8009015424425, 24.983899695712843, 9.129548316292933);
          this.camera.position.set(115.8009015424425, 24.983899695712843, 9);
          // 网格辅助线
          // const helper = new THREE.CameraHelper(this.camera)
          // this.scene.add(helper)
        }

        initModel() {
          try {
            // 创建组
            this.mapGroup = new THREE.Group();
            // const map = new THREE.Object3D()
            // 标签 初始化
            this.css2dRender = initCSS2DRender(this.options, this.container)
            const { depth, bevelThickness } = guiParams
            const gauge = depth + bevelThickness + 0.002
            const labelArr = []
            provinceData.features.forEach((elem, index) => {
              // 定一个省份对象 所有的积累
              const province = new THREE.Object3D();
              // 坐标
              const coordinates = elem.geometry.coordinates;
              // city 属性
              const properties = elem.properties;
              // 循环坐标
              coordinates.forEach((multiPolygon) => {
                multiPolygon.forEach((polygon) => {
                  const shape = new THREE.Shape(); // 行状，GIS通用格式
                  // 绘制shape 二维任意几何体类似svg适量图标
                  for (let i = 0; i < polygon.length; i++) {
                    let [x, y] = polygon[i];
                    if (i === 0) {
                      shape.moveTo(x, y);
                    }
                    shape.lineTo(x, y);
                  }
                  // 拉伸设置
                  // steps:1, // 横向的界断面数
                  // depth:1, // 横向面的单面，沿着Z轴的厚度
                  // bevelEnabled:true, // 是否显示厚度
                  // bevelThickness:5, // 厚度，双面向外延伸
                  // bevelSize:-0.1, // 凹凸度，正数向外吐出，负数向内凹陷
                  // bevelOffset:0, // 纵向面，两面延伸或者缩小
                  // bevelSegments:3, // 分段数，越大表面越光滑
                  // wireframe:false
                  const extrudeSettings = {
                    // steps:20,
                    depth, // 横向面的单面，沿着Z轴的厚度
                    bevelEnabled: true, // 是否显示厚度
                    // bevelOffset:0.1,
                    bevelSegments: 2, // 分段数，越大表面越光滑
                    bevelThickness, // 厚度，双面向外延伸
                    // wireframe: true
                  };

                  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

                  /*console.time('parseGeom');
                  const arr1 = new Array(geometry.attributes.position.count);
                  const arr = arr1.fill(1);
                  arr.forEach((a, index) => {
                      geometry.attributes.position.setZ(index, Math.floor(Math.random() * 100)/50);
                  });
                  console.timeEnd('parseGeom');*/
                  console.log('geometry-->', geometry)

                  const topFace1 = new THREE.MeshPhongMaterial({
                    map: textureMap,
                    transparent: false,// 是否透明
                    opacity: 1,  // 透明度
                  });

                  const mesh = new THREE.Mesh(geometry, [topFace1, sideMaterial])
                  province.add(mesh);
                });
              });
              province.properties = elem.properties
              // map.add(province)
              this.mapGroup.add(province);
              // 创建标点和标签
              // initLightPoint(properties, this.mapGroup, gauge); // 文字下面的光圈
              //
              labelArr.push({ properties: properties, gauge: gauge })
              // initLabel(properties, this.scene, gauge);
            });
            this.labelArr = labelArr
            // 创建上下边框
            initBorderLine(provinceData, this.mapGroup, this.scene, gauge);
            const earthGroupBound = getBoundingBox(this.mapGroup);
            centerXY = [earthGroupBound.center.x, earthGroupBound.center.y];
            let { size } = earthGroupBound;
            let width = size.x < size.y ? size.y + 1 : size.x + 1;
            // 添加背景，修饰元素
            this.rotatingApertureMesh = initRotatingAperture(this.scene, width); // 大光圈
            this.rotatingPointMesh = initRotatingPoint(this.scene, width - 2); // 小光圈
            initCirclePoint(this.scene, width);
            initSceneBg(this.scene, width);
            // 将组添加到场景中
            this.particleArr = initParticle(this.scene, earthGroupBound);
            // 创建河流
            // createFiveRiver(this.scene, this.mapGroup, gauge)
            this.scene.add(this.mapGroup);
            // 右上角创建控制器
            initGui();
            handleEvent(this.mouse)
          } catch (error) {
            console.log(error);
          }
        }

        getDataRenderMap() {

        }

        destroy() {
        }

        initControls() {
          super.initControls();
          this.controls.target = new THREE.Vector3(...centerXY, 0);
        }

        initLight() {
          //   平行光1
          let directionalLight1 = new THREE.DirectionalLight(0x000000, 1);
          directionalLight1.position.set(...centerXY, 30);
          //   平行光2
          let directionalLight2 = new THREE.DirectionalLight(0x000000, 1);
          directionalLight2.position.set(...centerXY, 30);
          // 环境光
          let ambientLight = new THREE.AmbientLight(0xffffff, 1);
          // 将光源添加到场景中
          this.addObject(directionalLight1);
          this.addObject(directionalLight2);
          this.addObject(ambientLight);
        }

        initRenderer() {
          super.initRenderer();
          // this.renderer.outputEncoding = THREE.sRGBEncoding
        }

        loop() {
          this.animationStop = window.requestAnimationFrame(() => {
            this.loop();
          });

          if(this.startPosition && this.endPosition){
            const elapsedTime = clock.getElapsedTime() - this.startTime;
            const t = elapsedTime / this.duration;
            const easedT = customEaseIn(t);
            if(!this.mapGroup) return;
            if (elapsedTime < this.duration) {
              // 根据t值计算当前位置
              this.mapGroup.position.x = this.startPosition.x + (this.endPosition.x - this.startPosition.x) * easedT;
              this.mapGroup.position.y = this.startPosition.y + (this.endPosition.y - this.startPosition.y) * easedT;
              this.mapGroup.position.z = this.startPosition.z + (this.endPosition.z - this.startPosition.z) * easedT;
              this.renderer.render(this.scene, this.camera);
            }else {
              if(this.labelArr){
                this.labelArr.forEach(item=>{
                  initLabel(item.properties, this.scene, item.gauge)
                })
                this.labelArr = null
              }
            }
          }
          // 这里是你自己业务上需要的code
          this.renderer.render(this.scene, this.camera);
          // 控制相机旋转缩放的更新
          if (this.options.controls.visibel && this.controls) {
            // this.controls.target.set(...centerXY, 0)
            this.controls.update();
          }
          // 统计更新
          if (this.options.statsVisibel) this.stats.update();
          if (this.rotatingApertureMesh) {
            this.rotatingApertureMesh.rotation.z += 0.0005;
          }
          if (this.rotatingPointMesh) {
            this.rotatingPointMesh.rotation.z -= 0.0005;
          }
          // 渲染标签
          if (this.css2dRender) {
            this.css2dRender.render(this.scene, this.camera);
          }
          // 粒子上升
          if (this.particleArr.length) {
            for (let i = 0; i < this.particleArr.length; i++) {
              this.particleArr[i].updateSequenceFrame();
              this.particleArr[i].position.z += 0.01;
              if (this.particleArr[i].position.z >= 6) {
                this.particleArr[i].position.z = -6;
              }
            }
          }
          // 流动
          if (lineTexture) lineTexture.offset.x -= 0.002

          // console.log(this.camera.position)
          // raycasterEvent(this)

          TWEEN.update();
        }

        resize() {
          super.resize();
          // 这里是你自己业务上需要的code
          this.renderer.render(this.scene, this.camera);
          this.renderer.setPixelRatio(window.devicePixelRatio);

          if (this.css2dRender) {
            this.css2dRender.setSize(this.options.width, this.options.height);
          }
        }
      }

      baseEarth = new CurrentEarth({
        container: '#three-map',
        axesVisibel: true,
        controls: {
          enableDamping: true, // 阻尼
          maxPolarAngle: (Math.PI / 2) * 0.98,
        },
        axesHelperSize: 50
      });
      baseEarth.run();
      window.addEventListener('resize', resize);
    });
    onBeforeUnmount(() => {
      window.removeEventListener('resize', resize);
    });

    return {
      handleReset: resize
    }
  },
};
</script>
<style>
.map-32-label {
  font-size: 12px;
  font-weight: bold;
  text-shadow: 0 0 10px #333;
  color: rgba(255, 255, 255, .9);
}
</style>
