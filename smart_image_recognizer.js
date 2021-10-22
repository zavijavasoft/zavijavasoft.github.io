var images;

function getImages() {
  images = document.getElementsByTagName('img');
  for (var i = 0; i < images.length; ++i) {
    console.log("Image ", images[i].src);
    var img = images[i];
    console.log(img);
    if (!!img._recogn) {
      continue;
    }
    __placeAnchor(img, "IndianaJones", 0.225, 0.235);
  }
  console.log('End of getImages()')
}

function startRecognition() {
  console.log("startRecognition called");
  images = document.getElementsByTagName('img');
  for (var i = 0; i < images.length; ++i) {
    var img = images[i];
    if (!!img._recogn) {
      continue;
    }
    if (!!yandex && !!yandex.imageRecognizer) {
      yandex.imageRecognizer.recognizeImage(images[i], function(result) {
        console.log(result.result);
        var objects = JSON.parse(result.result).objects;
        console.log(objects);
        for (var obj of objects) {
          __placeAnchor(img, obj.id, obj.center.x, obj.center.y);
        }
      });
    }
  }
}

function stopRecognition() {
  console.log("stopRecognition called");
  var hasAnchors;
  do {
    hasAnchors = false;
    images = document.getElementsByTagName('img');
    for (var i = 0; i < images.length; ++i) {
      var img = images[i];
      if (__removeAnchor(img)) {
        hasAnchors = true;
        break;
      }
    }
  } while (hasAnchors)
}

function __placeAnchor(img, id, x, y) {
  img._recogn = "target";
  var anchor = new Image();
  anchor.onload = function() {
    var xshift = -(1 - x) * img.width - anchor.width / 2;
    var yshift = -(1 - y) * img.height - anchor.height / 2;
    var style = "position: relative; left:" + xshift + "px; top:" + yshift + "px;";
    anchor.style = style;
    anchor._recogn = "anchor";
    anchor._id = id;
    anchor.onclick = function() {
      console.log("I'm clicked: " + anchor._id);
      if (!!yandex && !!yandex.imageRecognizer) {
        yandex.imageRecognizer.showImageInfo(anchor._id);
      }
    };
    img.insertAdjacentElement('afterEnd', anchor);
  }
  anchor.src = "thefoe-6.png";
}

function __removeAnchor(img) {
  switch (img._recogn) {
    case "anchor":
      img.parentNode.removeChild(img);
      return true;
    case "target":
      img._recogn = undefined;
      break;
  }
  return false;
}

console.log("Recognition script injected")
