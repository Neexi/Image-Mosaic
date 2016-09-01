importScripts("workerTools.js");

self.onmessage = function (e) {
    var imageData = e.data.data;
    var binaryData = imageData.data;
    var i = e.data.i;
    var height = e.data.height;
	var width = e.data.width;
	var tile_width = e.data.tile_width;

    var arr = getAverageImageDataRowArr(binaryData, height, width, tile_width);

    self.postMessage({ retI: i, arr: arr });
    self.close();  
};