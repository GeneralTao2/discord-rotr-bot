const fs = require('fs')
const fsPromises = fs.promises;
const { createCanvas, loadImage, Image } = require('canvas')
const tga2png = require('tga2png');
const readline = require('readline');

function stringToASCII(str) {
  let ASCIIstr = "";
  str = str.toLowerCase();
  for (let i = 0; i < str.length; i++) {
    if( (str[i] >= '0' && str[i]  <= '9') || (str[i] >= 'a' && str[i]  <= 'z')) {
      ASCIIstr += str[i];
    } else {
      const hexStr = (str[i].charCodeAt(0)).toString(16).toUpperCase();
      ASCIIstr += '_' + hexStr;
    }
  }
  return ASCIIstr
}
function isSpecialCaracter(ch) {
  for(let i=0; i<specialMatchCaracters.length; i++) {
    if(ch === specialMatchCaracters[i]) {
      return true;
    }
  }
  return false;
}
const specialMatchCaracters = '[\\^$.|?*+()'
function escapeSpecialMatchCharacters(reg) {
  let esapedStr = ""
  for(let i=0; i<reg.length; i++) {
    if(isSpecialCaracter(reg[i])) {
      esapedStr += '\\' + reg[i];
    } else {
      esapedStr += reg[i]
    }
  }
  return esapedStr
}


async function getMapInfo(mapName) {
  let mapNameASCII = stringToASCII(mapName);
  mapNameASCII = escapeSpecialMatchCharacters(mapNameASCII);
  let mapInfo = {
    name: null,
    size: null,
    isMultiplayer: null,
    numPlayers: null,
    playerStrats: [],
    techPosition: [],
    supplyPosition: []
  }
  let foudMapInfo = false;
  const readStream = fs.createReadStream('Maps/MapCache.ini')
  const lineStream = readline.createInterface(readStream)
  const stream = new Promise(resolve => {
    lineStream.on('line', line => {
      if(line) {
        const regex = new RegExp(mapNameASCII, "g");
        if(line.match(regex)) {
          foudMapInfo = true;
        }
        if(foudMapInfo) {
          if(line.match(/isMultiplayer/)) {
            mapInfo.isMultiplayer = line.match(/yes/) ? true : false;
          }
          if(line.match(/numPlayers/)) {
            mapInfo.numPlayers = parseInt(line.match(/.$/g)[0]);
          }
          if(line.match(/extentMax/)) {
            const extentMinMatch = line.match(/[+-]?\d+(?:\.\d+)?/g).map(Number);
            mapInfo.size = {
              x: extentMinMatch[0],
              y: extentMinMatch[1]
            }
          }
          if(line.match(/Player_._Start/)) {
            const playerStartMatch = line.match(/[+-]?\d+(?:\.\d+)?/g).map(Number);
            mapInfo.playerStrats.push({
              x: playerStartMatch[1],
              y: playerStartMatch[2]
            })
          }
          if(line.match(/techPosition/)) {
            const techPositionMatch = line.match(/[+-]?\d+(?:\.\d+)?/g).map(Number);
            mapInfo.techPosition.push({
              x: techPositionMatch[0],
              y: techPositionMatch[1]
            })
          }
          if(line.match(/supplyPosition/)) {
            const supplyPositionMatch = line.match(/[+-]?\d+(?:\.\d+)?/g).map(Number);
            mapInfo.supplyPosition.push({
              x: supplyPositionMatch[0],
              y: supplyPositionMatch[1]
            })
          }
          if(line.match(/END/)) {
            lineStream.close()
            lineStream.removeAllListeners();
            return;
          }
        }
      }
    })

    lineStream.on('close', (...args) => {
      resolve()
    })

  })
  await stream;
  return mapInfo;
}

async function makeImage(mapInfo) {
  const canvas = createCanvas(128, 128)
  const ctx = canvas.getContext('2d')
  const spawnImage = await loadImage('images/spawn.png');
  const techImage = await loadImage('images/tech.png');
  const supplyImage = await loadImage('images/supply.png');
  const mapBuffer = await tga2png('Maps/'+mapInfo.name+'/'+mapInfo.name+'.tga')
  const mapImage = new Image();
  mapImage.src = mapBuffer;
  ctx.drawImage(mapImage, 0, 0)
  const x_scale = 128/mapInfo.size.x;
  const y_scale = 128/mapInfo.size.y;
  for(let i=0; i<mapInfo.playerStrats.length; i++) {
    const x = mapInfo.playerStrats[i].x * x_scale;
    const y = (mapInfo.size.y - mapInfo.playerStrats[i].y) * y_scale;
    ctx.drawImage(spawnImage, x-8, y-8, 20, 20)
  }
  for(let i=0; i<mapInfo.supplyPosition.length; i++) {
    const x = mapInfo.supplyPosition[i].x * x_scale;
    const y = (mapInfo.size.y - mapInfo.supplyPosition[i].y )* y_scale;
    ctx.drawImage(supplyImage, x-7, y-7, 14, 14)
  }
  for(let i=0; i<mapInfo.techPosition.length; i++) {
    const x = mapInfo.techPosition[i].x * x_scale;
    const y = (mapInfo.size.y - mapInfo.techPosition[i].y) * y_scale;
    ctx.drawImage(techImage, x-7, y-7, 14, 14)
  }
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync('maked_maps/'+mapInfo.name+'.png', buffer)
}

async function doesMapExists(mapName) {
  try {
    await fsPromises.access('Maps/'+mapName);
    return true;
  } catch (error) {
    if(error) {
      return false
    }
  }
}

async function isMapNotGood(mapName) {
  let errors = {
    tga: null,
    map: null
  }
  try {
    errors.tga = await fsPromises.access('Maps/'+mapName+'/'+mapName+'.tga');
  } catch (error) {
    errors.tga = error
  }

  try {
    errors.map = await fsPromises.access('Maps/'+mapName+'/'+mapName+'.map');
  } catch (error) {
    errors.map = error
  }

  if(errors.tga || errors.map) {
    return errors
  }
  return null
} 

async function filterMaps() {
  const mapDirs = await fsPromises.readdir('Maps');
  for(let i=0; i<mapDirs.length; i++) {
    if(mapDirs[i] === "MapCache.ini") {
      continue
    }
    const isMapNotGoodResult = await isMapNotGood(mapDirs[i])
    if(isMapNotGoodResult) {
      await fsPromises.rmdir('Maps/'+mapDirs[i], {recursive: true})
    }
  }
}

async function makeAllImages() {
  try {
    await filterMaps();
    const maps = await fsPromises.readdir('Maps');
    for(let i=0; i<maps.length; i++) {
      if(maps[i] === "MapCache.ini") {
        continue
      }
      let mapInfo = await getMapInfo(maps[i]);
      mapInfo.name = maps[i]
      const makedMap = await makeImage(mapInfo)
    }
  } catch(error) {
    console.log(error);
  }
}

async function getMaps() {
  return await fsPromises.readdir('Maps');
}

async function getMapsByPlayerQuantity(playerQuantity) {
  const maps = await getMaps();
  const separatedMapInfos = []
  for(let i=0; i<maps.length; i++) {
    if(maps[i] === "MapCache.ini") {
      continue
    }
    let mapInfo = await getMapInfo(maps[i]);
    mapInfo.name = maps[i]
    if(mapInfo.playerStrats.length === playerQuantity) {
      separatedMapInfos.push(mapInfo);
    }
  }
  return separatedMapInfos
}

exports.getMapsByPlayerQuantity = getMapsByPlayerQuantity;
exports.getMaps = getMaps;
exports.makeAllImages = makeAllImages;
exports.getMapInfo = getMapInfo;
exports.makeImage = makeImage;
exports.filterMaps = filterMaps;
exports.doesMapExists = doesMapExists;
exports.isMapNotGood = isMapNotGood;