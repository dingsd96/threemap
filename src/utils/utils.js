import * as GeoTIFF from "geotiff";

export async function getTifConvertImage(url='') {
    const tif = await GeoTIFF.fromUrl(url);
    const image = await tif.getImage();
    const [red = [], green = red, blue = red] = await image.readRasters();
    // 将像素信息写入canvas
    const canvas = document.createElement("canvas");
    const width = image.getWidth();
    const height = image.getHeight();
    canvas.width = width;
    canvas.height = height;
    let ctx = canvas.getContext("2d");
    let imageData = ctx.createImageData(width, height);
    for (let i = 0; i < imageData.data.length / 4; i += 1) {
        imageData.data[i * 4 + 0] = red[i];
        imageData.data[i * 4 + 1] = green[i] || 0;
        imageData.data[i * 4 + 2] = blue[i] || 0;
        imageData.data[i * 4 + 3] = red[i] === 0 ? 0 : 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
}

// 坐标转换为three
export function lonlatToThree(lon, lat, height, center) {
    const z = height ? height : 0;
    const x = (lon / 180.0) * 20037508.3427892;
    let y = (Math.PI / 180.0) * lat;
    const tmp = Math.PI / 4.0 + y / 2.0;
    y = (20037508.3427892 * Math.log(Math.tan(tmp))) / Math.PI;
    return {
        x: x - center.x,
        y: -y + center.y,
        z: z - center.z,
    }
    // return [result.x / 1, result.y / 1, result.z / 1]
}

// 经纬高程转墨卡托
export function lonlatToMercator(lon, lat, height) {
    const z = height ? height : 0;
    const x = (lon / 180.0) * 20037508.3427892;
    let y = (Math.PI / 180.0) * lat;
    const tmp = Math.PI / 4.0 + y / 2.0;
    y = (20037508.3427892 * Math.log(Math.tan(tmp))) / Math.PI;
    return {
        x: x,
        y: y,
        z: z,
    };
}
