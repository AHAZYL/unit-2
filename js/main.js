// declare map variable globally so all functions have access
var map;


// Instantiate and configure the map
function createMap() {

  // Create the map centered on U.S.
  map = L.map("map", {
    center: [39, -98],
    zoom: 4
  });

  // Add CARTO dark basemap
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(map);

  // Load the data
  getData(map);
}


// Attach popups to each feature
function onEachFeature(feature, layer) {

  var popupContent = "";
  if (feature.properties) {

    popupContent += "<strong>" + feature.properties.name + "</strong>";    // add city name first

    // Loop through all properties
    for (var property in feature.properties) {
      if (property !== "name") {    // Add city name first

        popupContent +=
          "<p>" + property + ": " +
          feature.properties[property] +
          " hot days</p>";
      }
    }

    layer.bindPopup(popupContent);
  }
}


// Load GeoJSON data and style points
function getData(map) {

  fetch("data/US_Cities_Hot_Days.geojson")
    .then(function(response) {
      return response.json();
    })
    .then(function(json) {

      // Define circle marker style options
      var geojsonMarkerOptions = {
        radius: 8,
        fillColor: "#ff6b6b",
        color: "#ffffff",
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.5
      };

      // Create GeoJSON layer
      var geoLayer = L.geoJson(json, {

        // Convert GeoJSON points to circle markers
        pointToLayer: function(feature, latlng) {
          return L.circleMarker(latlng, geojsonMarkerOptions);
        },

        // Attach popups
        onEachFeature: onEachFeature
      }).addTo(map);

      map.fitBounds(geoLayer.getBounds());
    });
}


// Run createMap()
document.addEventListener("DOMContentLoaded", createMap);

