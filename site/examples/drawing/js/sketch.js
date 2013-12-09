// get the canvas element and its context
var canvas = document.querySelector('#sketch');
var context = canvas.getContext('2d');

canvas.width = 1140;
canvas.height = 400;

var lastMouse = {
  x: 0,
  y: 0
};

// brush settings
context.lineWidth = 2;
context.lineJoin = 'round';
context.lineCap = 'round';
context.strokeStyle = '#000';

// attach the mousedown, mouseout, mousemove, mouseup event listeners.
canvas.addEventListener('mousedown', function (e) {
  lastMouse = {
    x: e.pageX - this.offsetLeft,
    y: e.pageY - this.offsetTop
  };
  canvas.addEventListener('mousemove', move, false);
}, false);

canvas.addEventListener('mouseout', function () {
  canvas.removeEventListener('mousemove', move, false);
}, false);

canvas.addEventListener('mouseup', function () {
  canvas.removeEventListener('mousemove', move, false);
}, false);

// Sets the brush size:
function setSize(size) {
  context.lineWidth = size;
}

// Sets the brush color:
function setColor(color) {
  context.globalCompositeOperation = 'source-over';
  context.strokeStyle = color;
}

// Sets the brush to erase-mode:
function eraser() {
  context.globalCompositeOperation = 'destination-out';
  context.strokeStyle = 'rgba(0,0,0,1)';
}

// Draws the lines, called by move and the TogetherJS event listener:
function draw(start, end, color, size, compositeOperation) {
  context.save();
  context.strokeStyle = color;
  context.globalCompositeOperation = compositeOperation;
  context.lineWidth = size;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.closePath();
  context.stroke();
  context.restore();
}

// Called whenever the mousemove event is fired, calls the draw function:
function move(e) {
  var mouse = {
    x: e.pageX - this.offsetLeft,
    y: e.pageY - this.offsetTop
  };
  draw(lastMouse, mouse, context.strokeStyle, context.lineWidth, context.globalCompositeOperation);
  if (TogetherJS.running) {
    TogetherJS.send({
      type: 'draw',
      start: lastMouse,
      end: mouse,
      color: context.strokeStyle,
      size: context.lineWidth,
      compositeOperation: context.globalCompositeOperation
    });
  }
  lastMouse = mouse;
}

// Listens for draw messages, sends info about the drawn lines:
TogetherJS.hub.on('draw', function (msg) {
  if (!msg.sameUrl) {
      return;
  }
  draw(msg.start, msg.end, msg.color, msg.size, msg.compositeOperation);
});

// Hello is sent from every newly connected user, this way they will receive what has already been drawn:
TogetherJS.hub.on('togetherjs.hello', function () {
  var image = canvas.toDataURL('image/png');
  TogetherJS.send({
    type: 'init',
    image: image
  });
});

// Draw initially received drawings:
TogetherJS.hub.on('init', function (msg) {
  var image = new Image();
  image.src = msg.image;
  context.drawImage(image, 0, 0);
});

// JQuery to handle buttons, also changes the cursor to a dot resembling the brush size:
$(document).ready(function () {
  // changeMouse creates a temporary invisible canvas that shows the cursor, which is then set as the cursor through css:
  function changeMouse() {
    var cursorSize = context.lineWidth;
    if (cursorSize < 10){
        cursorSize = 10;
    }
    var cursorColor = context.strokeStyle;
    var cursorGenerator = document.createElement('canvas');
    cursorGenerator.width = cursorSize;
    cursorGenerator.height = cursorSize;
    var ctx = cursorGenerator.getContext('2d');

    var centerX = cursorGenerator.width/2;
    var centerY = cursorGenerator.height/2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, (cursorSize/2)-4, 0, 2 * Math.PI, false);
    ctx.lineWidth = 3;
    ctx.strokeStyle = cursorColor;
    ctx.stroke();
    $('#sketch').css('cursor', 'url(' + cursorGenerator.toDataURL('image/png') + ') ' + cursorSize/2 + ' ' + cursorSize/2 + ',crosshair');
  }
  // Init mouse
  changeMouse();
  // Color-button functions:
  $(".color-picker").click(function () {
    var $this = $(this);
    console.log($this);
    setColor($this.css("background-color"));
    changeMouse();
  });

  $('.eraser').click(function () {
    eraser();
    changeMouse();
  });
  // TogetherJS user color:
  $('.user-color-pick').click(function() {
    setColor(TogetherJS.require('peers').Self.color);
    changeMouse();
  });

  // Increase/decrease brush size:
  $('.plus-size').click(function() {
    setSize(context.lineWidth+3);
    changeMouse();
  });

  $('.minus-size').click(function() {
    if (context.lineWidth > 3) {
      setSize(context.lineWidth-3);
    }
    changeMouse();
  });          
});
