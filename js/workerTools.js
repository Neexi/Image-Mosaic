//Hex code for testing purpose
var COLOR_HEX = "000000";

/**
	Get the tile array of this row with average color hex value
	TODO : Better name
**/
var getAverageImageDataRowArr = function (binaryData, height, width, tile_width) {
	//loop the tile in this row
	var arr = [];
	for(var i = 0; i < width; i += tile_width) {
		var average = [0,0,0]; //Array to store the average value of r,g,b
		var curWidth = tile_width; //Current tile width
		var resWidth = width - Math.floor(width/tile_width) * tile_width;
		if(i > width - tile_width && resWidth > 0) curWidth = resWidth; //change the current tile width for residual tile if exist
		//Get the r,g,b sum of 1 tile
		for(var j = i; j < (i+height*width); j+=width) {
			for(var k = j*4; k < (j+curWidth)*4; k+=4) {
				average[0] += binaryData[k];
				average[1] += binaryData[k+1];
				average[2] += binaryData[k+2];				
			}
		}
		//Average the r,g,b value
		var count = curWidth * height;
		for(var index = 0; index < 3; index++) {
			average[index] = average[index] / count;
		}
		//Construct the hex string for this tile
		var hexString = "";
		for(var index = 0; index < 3; index++) {
			//Convert the average decimal value to hex string and append it
			var rounding = Math.round(average[index]);
			//If value is smaller than 16 (resulting in 1 digit hex), don't forget to assign extra 0
			if(rounding < 16) hexString += "0";
			hexString += Math.round(average[index]).toString(16);
		}
		arr.push("color/"+hexString);				
	}
	return arr;
};

/**
	Return array full of black hex value
	Used for testing
**/
var getSameColorArray = function (binaryData, height, width, tile_width) {
	var arr = [];
	for (var i = 0; i < width; i+=tile_width)
	{
		arr.push(COLOR_HEX);
	}
	return arr;
}