var images;

function getImages() {
  images = document.getElementsByTagName('img');
  for (var i = 0; i < images.length; ++i) {
    console.log("Image ", images[i].src);
    yandex.imageRecognizer.recognizeImage(images[i], function (result) {
      console.log(result);
    })
  }
}

function startRecognition() {
  console.log("startRecognition called");
}

function startRecognition() {
  console.log("stopRecognition called");
}

console.log("Recognition script injected")
