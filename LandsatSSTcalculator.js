///////////// BC Landsat SST calculator 
// By Alejandra Mora-Soto, 2023 

// Geometry = any given area
// You can make your own geometries as well! 
Map.setCenter(-124.211, 49.15, 8 )// Set Center: Vancouver Island 
// Step 1= Set year and month 
var month = ee.Filter.calendarRange(7, 8, 'month');// 7 and 8 for Summer; 5 and 6 for spring 
var year = ee.Filter.calendarRange(2022, 2022, 'year');// change year here 
var cloudc = ee.Filter.lt('CLOUD_COVER', 50); // set at 50% but it can be less (50% to expand the search)

/// Datasets
////////////////// Landsat 5 ///////////////// // 1984 up to 2011
var dataL5 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
    .filter(year)
    .filter(month)
    .filter(cloudc)
    .filterBounds(geometry2);

////////////////// Landsat 7 /////////////////// from 1999-05-28
var dataL7 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
    .filter(year)
    .filter(month)
    .filter(cloudc)
    .filterBounds(geometry2);


/////////////////////////// Landsat 8////////////////////////from 2013-03-18
var dataL8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filter(year)
    .filter(month)
    .filter(cloudc)
    .filterBounds(geometry2);


//Scaling factors.
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}
// Cloud masking
function maskCloudAndShadow(image){
  //get the Pixel QA Band
  var qa = image.select('QA_PIXEL');
  //get the cloud and cloud shadow flags (5 & 3, respectively) and convert them to bitwise, or simply, 2 ^ to these numbers 
  var cloudBitMask = ee.Number(2).pow(3).int();
  var cloudShadowBitMask = ee.Number(2).pow(4).int();
    // take the lowest of such masks and combine
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(qa.bitwiseAnd(cloudShadowBitMask).eq(0));
    // Return the masked and scaled image
  return image.updateMask(mask)//.multiply(0.0001)
}

// Functions to datasets
var BC_scaled_L5 = dataL5.map(applyScaleFactors);
var BC_cloud_L5 = BC_scaled_L5.map(maskCloudAndShadow);


var BC_scaled_L7 = dataL7.map(applyScaleFactors);
var BC_cloud_L7 = BC_scaled_L7.map(maskCloudAndShadow);


var BC_scaled_L8 = dataL8.map(applyScaleFactors);
var BC_cloud_L8 = BC_scaled_L8.map(maskCloudAndShadow);


/// Thermal functions (to get celcius)
// Landsat 5 and 7
function thermal(image){
  //get the thermal Band
  var ther = image.select('ST_B6').subtract(273.15).rename('temp');
  return image.addBands(ther)
    .mask(BC_lm)
    .clip(geometry2)
    .select('temp')
    .updateMask(ther.gte(1));
}
// Landsat 8
function thermal8(image){
  //get the thermal Band
  var therL8 = image.select('ST_B10').subtract(273.15).rename('temp');
  return image.addBands(therL8)
    .mask(BC_lm)
  .clip(geometry2)
  .select('temp')
   .updateMask(therL8.gte(1));
}

var bandtenL5 = BC_cloud_L5.map(thermal); // Landsat 5
var bandtenL7 = BC_cloud_L7.map(thermal);// Landsat 7 
var bandtenL8 = BC_cloud_L8.map(thermal8);// Landsat 8
var bandthermalL5L7 = bandtenL7.merge(bandtenL5); ///Merges Landsat 5 and 7 
var bandthermal = bandthermalL5L7.merge(bandtenL8);/// Three datasets combined
//var bandthermal = bandtenL8 // Activate this if you only want to have Landsat 8 (From 2013 on)
var SOG_SST_Summer = bandthermal.mean();// Mean by default; you can choose among "min", "max", "median", "mode"

print('SoG Collection Summer',  bandthermal);/// The complete list of images that are agreggated in this composite image.

var thermalparams = {min:0, max:30,palette: [
'040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6',
 '0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef',
'3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f',
 'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff6e08', 'ff500d',
 'ff0000', 'de0101', 'c21301', 'a71001', '911003']};
Map.addLayer(SOG_SST_Summer, thermalparams, 'thermal average');/// The final image. 


//// Export image to asset
Export.image.toAsset({
  image: SOG_SST_Summer,
  description: 'SST_SOG_Summer_2008_ALL', /////////////////////////////Change name HERE
  scale: 30,
  maxPixels: 1e13
});

/// export image collection to drive- This gathers the names and properties of the images included in this mean 
Export.table.toDrive({
    collection: bandthermal, 
    description: 'SST_SOG_Summer_2008_ALL',  /////////////////////////////Change name HERE
    folder: 'BC/Strait of Georgia', 
    fileFormat: 'CSV'
    });
