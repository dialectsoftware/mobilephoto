/*****************************************************************************************************************************************
 * 
 *   The MIT License (MIT)
 *   Copyright © 2021 Dialect Software LLC
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
 *   files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, 
 *   modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software 
 *   is furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES 
 *   OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE 
 *   LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN 
 *   CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * 
 *****************************************************************************************************************************************/

const constraints = { video: { facingMode: "environment" }, audio: false };
const cameraView = document.querySelector("#camera");
const cameraTrigger = document.querySelector("#trigger");

var track = null;
var killswitch = -1
var viewModel = {
    tags: ko.observable(),// Initially blank
    results: ko.observable(),// Initially blank
    imagePath: ko.observable(), // Initially blank
    items: ko.observableArray([])
};

window.addEventListener("orientationchange", function() {
    clearTimeout(killswitch);
    var evt = document.createEvent("HTMLEvents");
    evt.initEvent("load", true, true ); // event type,bubbling,cancelable
    return !window.dispatchEvent(evt);
});

cameraView.addEventListener('play', () => {
    var canvas = document.getElementById('canvas');
    canvas.width = cameraView.videoWidth;
    canvas.height = cameraView.videoHeight;
    var context = canvas.getContext('2d');
    var cw = Math.floor(cameraView.videoWidth / 2) - 120;
    var ch = Math.floor(cameraView.videoHeight / 2) - 100;

    if(killswitch == -1)
    {
       cameraTrigger.addEventListener('click', async () => {
            
            var idata = context.getImageData(cw, ch, 250, 200);
            var jpeg = document.createElement('canvas');
            jpeg.width = 250;
            jpeg.height = 200;
            var ctx = jpeg.getContext('2d');
            ctx.putImageData(idata,0,0);   
            
            jpeg.toBlob( async (blob) => {
                cameraView.pause();
                cameraView.currentTime = 0;
                post(blob, async (status, json)=>{
                    url = URL.createObjectURL(blob);
                    let labels = await classify(jpeg);
                    json.status = status
                    render(url, labels[0].className, json);
                })                
            }, "image/jpeg", 1.0);
        });
    }

    draw(cameraView,context,cw,ch);
});

async function start() {
    // Load the model.
    net = await mobilenet.load();

    navigator.mediaDevices
        .getUserMedia(constraints)
        .then(function(stream) {
            track = stream.getTracks()[0];
            cameraView.srcObject = stream;
            cameraView.onloadedmetadata = function(e) {
                cameraView.play();
                cameraView.style.visibility = "visible"
            };
            
        })
        .catch(function(error) {
            console.error("Oops. Something is broken.", error);
    });
}

function draw(video,context,w,h) {
    if(video.paused || video.ended) return false;

    context.drawImage(video, 0, 0);
    
    var element = document.getElementById('video');
    element.width = 250; 
    element.height = 200;
    
    var ctx = element.getContext('2d');
    ctx.drawImage(video, w, h, element.width, element.height, 0, 0, element.width, element.height);
    ctx.strokeStyle = "white";
    ctx.beginPath();
    ctx.lineWidth = 5
    ctx.rect(0, 0, 250, 200);
    ctx.stroke();
    killswitch = setTimeout(draw,20,video,context,w,h);
}

function render(url, label, data) {
    fetch("components/details.html"  /*, options */)
    .then((response) => response.text())
    .then((html) => {
        viewModel.imagePath(url);
        viewModel.tags(label);
        viewModel.results(JSON.stringify(data, null, 2));
        Object.keys(data).forEach(key=>{
            viewModel.items.push({key:key,value:data[key]});
        })
        var view  = document.getElementById("view")
        view.innerHTML = html;
        ko.applyBindings(viewModel, view)
        
    })
    .catch((error) => {
        console.warn(error);
    });
}

async function classify(img) {
    const result = await net.classify(img);
    return result;
}

function post(blob, cb) {
    var formData = new FormData();
    formData.append("image", blob);
    var xhr = new XMLHttpRequest();
    var url = window.location.hash.replace('#','');
    xhr.open("POST", url, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {      
          if(xhr.status == 200) {
             cb(xhr.status, JSON.parse(this.responseText));
          } else {
            cb(xhr.status, {url:`${url}`});
          }
        }
    }
   
    xhr.send(formData);
}

// Start the video stream when the window loads
window.addEventListener("load", start, false);
