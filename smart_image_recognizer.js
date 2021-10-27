var images;

var timeOutId = null;

var anchors = [];

var _minHeight = 100;
var _minWidth = 100;
var _animationRequest;
const maxAnchorSizeVW = 4.25;
const boxShadowSizeVW = 0.5;

function startRecognition(minWidth = 100, minHeigth = 100) {
  console.log("startRecognition called");
  _minHeight = minHeigth;
  _minWidth = minWidth;
  __handleImages();
  _animationRequest = requestAnimationFrame(__animate);
}

function continueRecognition() {
  console.log("continueRecognition called");
  cancelAnimationFrame(_animationRequest);
  document.body.addEventListener("touchend", __onTouchEvent, false);
  document.body.addEventListener("touchcancel", __onTouchEvent, false);
  document.body.addEventListener("touchmove", __onTouchMoveEvent, false);
  _animationRequest = requestAnimationFrame(__animate);
}

function pauseRecognition() {
  console.log("pauseRecognition called");
  document.body.removeEventListener("touchend", __onTouchEvent, false);
  document.body.removeEventListener("touchcancel", __onTouchEvent, false);
  document.body.removeEventListener("touchmove", __onTouchEvent, false);
}

function stopRecognition() {
  cancelAnimationFrame(_animationRequest);
  console.log("stopRecognition called");
  pauseRecognition();

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
  anchors = [];
}

function __placeAnchor(img, id, x, y) {
  img._recogn = "target";
  img._recogn_id = img._recogn_id || id;
  var anchor = document.createElement("div");
  anchor.id = id;
  anchor._x = x;
  anchor._y = y;
  anchor._recogn = "anchor";
  anchor._live = performance.now();
  anchor.img_id = img._recogn_id;
  var rect = img.getBoundingClientRect();
  var absX = rect.left + x * rect.width + pageXOffset;
  var absY = rect.top + y * rect.height + pageYOffset;
  var anchor_style = "position: absolute; left:" + absX + "px; top:" + absY + "px;";
  anchor_style += "z-index: 2147483647;";
  console.log("Z-Index " + img.style.zIndex + 1);
  anchor_style += " width: 0vw; height: 0vw; ";
  anchor_style += "transform: translate(-50% , -50% );";
  anchor_style += "box-shadow: inset 0px 0px 0px 0.5vw rgb(255 255 255);";
  anchor_style += "border-radius: 50% ;";
  anchor_style += "background: linear-gradient(45deg, rgb(135 50 220), rgb(135 50 220 / 50% ));";
  anchor.style = anchor_style;
  anchor.onclick = function() {
    console.log("I'm clicked: " + anchor.id);
    if (!!yandex && !!yandex.imageRecognizer) {
      yandex.imageRecognizer.showObjectInfo(img, anchor.id);
    }
  };
  anchors.push(anchor);
  document.body.appendChild(anchor);
}

function __removeAnchor(img) {
  switch (img._recogn) {
    case "anchor":
      img.parentNode.removeChild(img);
      return true;
    case "target":
      img._recogn = undefined;
      img._recogn_id = undefined;
      break;
  }
  return false;
}

function __replaceAnchorsForImage(img) {
  if (!img._recogn) {
    return;
  }

  for (i of anchors) {
    if (i.img_id == img._recogn_id) {
      var rect = img.getBoundingClientRect();
      var absX = rect.left + i._x * rect.width + pageXOffset;
      var absY = rect.top + i._y * rect.height + pageYOffset;
      i.style.left = absX + "px";
      i.style.top = absY + "px";
    }
  }
}

function __handleImages() {
  images = document.getElementsByTagName('img');
  for (var i = 0, ln = images.length; i < ln; ++i) {
    const img = images[i];
    if (!!img._recogn) {
      __replaceAnchorsForImage(img);
      continue;
    }
    if (img.height < _minHeight) {
      continue;
    }
    if (img.width < _minWidth) {
      continue;
    }
    if (!__isImageInViewPort(img)) {
      continue;
    }
    if (!!yandex && !!yandex.imageRecognizer) {
      yandex.imageRecognizer.recognizeImage(img, function(result) {
        var objects = JSON.parse(result.result).objects;
        console.log("Recognized " + objects.length + " objects");
        for (var obj of objects) {
          __placeAnchor(img, obj.id, obj.center.x, obj.center.y);
        }
      });
    } else {
      __placeAnchor(img, String(Math.random()), 0.1, 0.1);
      __placeAnchor(img, String(Math.random()), 0.5, 0.5);
    }
  }
}

function __onTouchMoveEvent(evt) {
  console.log("touch move handling");
  __handleImages();
}

function __onTouchEvent(evt) {
  console.log("touch end handling");
  __handleImages();
  setTimeout(__handleImages, 500);
}

function __animate(delay) {
  for (i of anchors) {
    var rect = i.getBoundingClientRect();
    var height = document.documentElement.clientHeight;
    if (rect.top < height * 0.1) {
      i.style.opacity = __clamp(rect.top / (height * 0.1), 0, 1);
    } else if (rect.bottom > height * 0.9) {
      i.style.opacity = __clamp(((height - rect.bottom) / (height * 0.1)), 0, 1);
    } else {
      i.style.opacity = 1;
    }
    if (i._live < 0) {
      continue;
    }
    var delta = delay - i._live;
    if (delta > 300) {
      delta = 300;
      i._live = -1;
    }
    var value = maxAnchorSizeVW * 1.20 * Math.sin(delta / 139.2);
    i.style.width = value + "vw";
    i.style.height = value + "vw";
    var boxSize = value / maxAnchorSizeVW * boxShadowSizeVW;
    i.style.boxShadow = "inset 0px 0px 0px " + boxSize + "vw rgb(255 255 255)";
  }
  _animationRequest = requestAnimationFrame(__animate);
}

function __clamp(value, start, end) {
  return Math.min(Math.max(value, start), end);
}

function __isImageInViewPort(img) {
  var rect = img.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.left <= (window.innerWidth || document.documentElement.clientWidth)
  ) || (
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)

  );
}

console.log("Recognition script injected")
