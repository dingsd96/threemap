const useConversionStandardData = () => {
  /**
   * 转换geoJson数据,将单个数组转为多维数组
   * @param {*} data geo数据
   * @returns
   */
  const transfromGeoJSON = (data) => {
    return {
      type: data.type,
      features: data.features.map((item,index)=>{
        const properties = item.properties
        const geometry = item.geometry
        return {
          type: item.type,
          geometry: {
            type: geometry.type,
            coordinates: [geometry.coordinates]
          },
          properties: {
            "adcode": properties.AD_CODE,
            "name": properties.AD_NAME,
            "center": geometry.coordinates[0][0],
            "centroid": geometry.coordinates[0][0],
            "childrenNum": 18,
            "level": "city",
            "parent": {
              "adcode": 360700
            },
            "subFeatureIndex": index,
            "acroutes": [
              100000,
              360000,
              360700
            ]
          }
        }
      })
    }
  }
  /**
   * 转换路网数据，跟世界数据保持一致的格式
   * @param {*} roadData
   * @returns
   */
  const transformGeoRoad = (roadData)=>{
    let features = roadData.features
    for (let i = 0; i < features.length; i++) {
      const element = features[i]
       //LineString处理跟MultiLineString一样的数据结构
       if (element.geometry.type === 'LineString') {
        element.geometry.coordinates = [[element.geometry.coordinates]]
       }else{
        element.geometry.coordinates = [element.geometry.coordinates]
       }

    }
    return roadData
  }
  return { transfromGeoJSON,transformGeoRoad }
}
export default useConversionStandardData
