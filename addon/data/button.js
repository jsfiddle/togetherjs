self.port.on("TowTruckOn", function () {
  document.getElementById("towtruck-button").innerHTML = "truckin'";
});

self.port.on("TowTruckOff", function () {
  document.getElementById("towtruck-button").innerHTML = "towtruck";
});
