// needs to connect to a Socket.IO based server - as you'd do on the client side
var socket = new io.Socket('localhost', {'port': 8000});

socket.on('connect', function () {
  console.log('yay, connected!');
  socket.send('hi there!');
});

socket.on('message', function (msg) {
  console.log('a new message came in: ' + JSON.stringify(msg));
});

socket.connect();
