var images;

function startRecognition() {
  console.log("startRecognition called");
  images = document.getElementsByTagName('img');
  for (var i = 0, ln = images.length; i < ln; ++i) {
    const img = images[i];
    if (!!img._recogn) {
      continue;
    }
    if (!!yandex && !!yandex.imageRecognizer) {
      yandex.imageRecognizer.recognizeImage(img, function(result) {
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
    divs = document.getElementsByTagName('div');
    for (var i = 0; i < divs.length; ++i) {
      var div = divs[i];
      if (__removeAnchor(div)) {
        hasAnchors = true;
        break;
      }
    }
  } while (hasAnchors)
}

function __placeAnchor(img, id, x, y) {
  img._recogn = "target";
  var anchor = document.createElement("div");
  var rect = img.getBoundingClientRect();
  var absX = rect.left + x * rect.width + pageXOffset;
  var absY = rect.top + y * rect.height + pageYOffset;
  var anchor_style = "position: absolute; left:" + absX + "px; top:" + absY + "px;";
  anchor_style += " width: 4.25vw; height: 4.25vw; ";
  anchor_style += "transform: translate(-50% , -50% );";
  anchor_style += "box-shadow: inset 0px 0px 0px 0.5vw rgb(255 255 255);";
  anchor_style += "border-radius: 50% ;";
  anchor_style += "background: linear-gradient(45deg, rgb(135 50 220), rgb(135 50 220 / 50% ));";
  anchor.style = anchor_style;
  anchor._recogn = "anchor";
  anchor._id = id;
  anchor.onclick = function() {
    console.log("I'm clicked: " + anchor._id);
    if (!!yandex && !!yandex.imageRecognizer) {
      yandex.imageRecognizer.showObjectInfo(anchor._id);
    }
  };
  document.body.appendChild(anchor);
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
