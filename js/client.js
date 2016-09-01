//Constants
var NUM_WORKERS = 8;
var USING_WEB_WORKERS = true;
//ID of HTML Elements
var HEADER1 = "header1";
var IMAGE = "image";
var DISPLAY_CANVAS = "myCanvas";
//Path, might need to be adjusted for different operating system
var WEB_WORKER_PATH = "js/worker.js";
//Messages
var HELLO_WORLD = "Hello World!"
var FILEREADER_SUCCESS = "Have Some Mosaic!";
var FILEREADER_FAIL = "File Not Found :(";

window.onload = function() {
    document.getElementById(HEADER1).innerHTML = HELLO_WORLD;
}

/*
	Display the input image and its mosaic version
*/
function displayImage(input) {
    var target;

    //Handing file selection for different browsers, as Firefox does not have window.event functionality
    if (window.event) {
        target = input.target || window.event.srcElement;
    } else {
        target = input;
    }
    var files = target.files;

    //Filereader to store the selected image
    if (FileReader && files && files.length) {
        var filereader = new FileReader();
        var image = document.getElementById(IMAGE);
        //Canvas for source image
        var canvas = document.getElementById(DISPLAY_CANVAS);
        document.getElementById(HEADER1).innerHTML = FILEREADER_SUCCESS;

        filereader.onload = function() {
            //Set the selected image to image element to be used in a canvas
            image.src = filereader.result
            //But do not actually display the original image
            //image.style.display = 'block';

            //Resize the canvas to be equal to the image and set it visible
            //TODO : Fix firefox canvas preview issues
            canvas.width = image.width;
            canvas.height = image.height;
            canvas.style.display = 'block';

            //Retrieve the image data and perform mosaic rendering
            var context = canvas.getContext("2d");
            context.clearRect(0, 0, canvas.width, canvas.height); //Clear the canvas first
            //The image must be drawn on the canvas first in order to get the image color data
            context.drawImage(image, 0, 0);
            mosaicImageMulti(context, image.width, image.height);
        }
        filereader.readAsDataURL(files[0]);
    } else {
        //TODO: Better error handling
        document.getElementById(HEADER1).innerHTML = FILEREADER_FAIL;
    }
}

/*
	Performing mosaic transformation to an image on the canvas by first dividing them into
	several rows of tiles, which average color per tile then computed and fetched from the server
*/
function mosaicImageRow(context, width, height) {
    var imagesMap = {}; //Map containing all images, keyed by the y index
    var curI = 0; //Current row coordinate to be drawn on canvas
    var numRow = Math.ceil(height / TILE_HEIGHT);
    //Divide the image to row of tiles
    for (var i = 0; i < height; i += TILE_HEIGHT) {
        var imageData = context.getImageData(0, i, width, TILE_HEIGHT);
        var block_height = TILE_HEIGHT;

        //Compute the image data of end tile differently
        //This is important for image that cannot be evenly divided by configured tile width/height
        if (i + TILE_HEIGHT > height) {
            imageData = context.getImageData(0, i, width, height - i);
            block_height = height - i;
        }
        var binaryData = imageData.data;
        //Get the array containing average color hex string for this row of tiles
        var arr = getAverageImageDataRowArr(binaryData, block_height, width, TILE_WIDTH);
        //Load all the tiles in that row array, then render them at canvas accordingly
        loadImages(arr, i, function(images, retI) {
        	curI = postLoadOperation(context, imagesMap, images, retI, curI, width, height)
        });
    }
}

/*
	Perform mosaicImageRow operation using multiple web workers
*/
function mosaicImageMulti(context, width, height) {
    //If web worker is not supported, run the single threaded function
    if (!window.Worker && USING_WEB_WORKERS) {
        mosaicImageRow(context, width, height);
        return;
    }
    var curWorker = 0;
    var queue = []; //Use queue to store row that has not been assigned to a web worker
    var imagesMap = {}; //Map containing all images, keyed by the y index
    var curI = 0; //Current row coordinate to be drawn on canvas
    var numRow = Math.ceil(height / TILE_HEIGHT);
    //Divide the work into row of tiles
    for (var i = 0; i < height; i += TILE_HEIGHT) {
    	//Add current row to the queue
        queue.push(i);

        //Will be run after the web worker has done constructing the hex string array assigned to it
        var onWorkEnded = function(e) {
            var retI = e.data.retI;
            //The constructed image hex array
            var arr = e.data.arr;
            //Load all the tiles in that row array, then render them at canvas accordingly
            loadImages(arr, retI, function(images, retRetI) {
            	curI = postLoadOperation(context, imagesMap, images, retRetI, curI, width, height)
            });
            curWorker--;
            //Call another web worker after one has finished its job
            checkWorker();
        };

        //Function to limit the number of workers, too many workers will be inefficient
        var checkWorker = function() {
        	//Also, only run web workers if there are at least one row to be done
            if (curWorker < NUM_WORKERS && queue.length > 0) {
                curWorker++;
                //Assign a new worker to certain row
                var worker = new Worker(WEB_WORKER_PATH);
                worker.onmessage = onWorkEnded;
                var thisI = queue.shift(); //Row coordinate that is assigned to this worker
                var imageData = context.getImageData(0, thisI, width, TILE_HEIGHT);
                var block_height = TILE_HEIGHT;
                //Compute the image data of end tile differently
                //This is important for image that cannot be evenly divided by configured tile width/height				
                if (thisI + TILE_HEIGHT > height) {
                    imageData = context.getImageData(0, thisI, width, height - thisI);
                    block_height = height - thisI;
                }

                //Send the necessary information to the worker
                worker.postMessage({
                    data: imageData,
                    i: thisI,
                    height: block_height,
                    width: width,
                    tile_width: TILE_WIDTH
                });
            }
        }
        checkWorker();
    }
}

/**
	Preloading all tile images listed in sources
	After all tiles are done loading, do a callback
**/
function loadImages(sources, y, callback) {
    var images = [];
    var loadedImages = 0;
    var numImages = sources.length;
    for (var i = 0; i < numImages; i++) {
        images[i] = new Image();
        images[i].onload = function() {
            if (++loadedImages >= numImages) {
                callback(images, y);
            }
        };
        images[i].src = sources[i];
    }
}

/**
	Will be executed after a row of tiles has done loading
**/
function postLoadOperation(context, imagesMap, images, retI, curI, width, height) {
    //Assign the loaded tiles image to the map under respective coordinate key
    imagesMap[retI] = images;
    //If all tiles for current row to be rendered have finished loading, 
    //render them on the canvas until the row that has not finished loading is found
    if (retI == curI) {
        curI = updateCanvas(context, imagesMap, curI, width, height);
    }
    //Return the updated current row
    return curI; 	
}

/**
	Update the canvas until the end of canvas or row that has not been loaded is found
**/
function updateCanvas(context, imagesMap, curI, width, height) {
    var numCol = Math.ceil(width / TILE_WIDTH);
    //A row that has not been loaded won't exist in the map
    for (var i = curI; i < height && (i in imagesMap); i += TILE_HEIGHT) {
        context.clearRect(0, i, width, TILE_HEIGHT);
        for (var j = 0; j < numCol; j++) {
            context.drawImage(imagesMap[i][j], j * TILE_WIDTH, i);
        }
        //Delete the mapping to save space
        delete imagesMap[i];
    }
    //variable 'i' should contains the topmost row that has not been rendered
    return i;
}