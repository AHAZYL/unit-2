// Declare the map variable in global scope
// This allows multiple functions to access it
var map;


// Create and initialize the Leaflet map
function createMap() {

  // Instantiate the map inside <div id="map">
  map = L.map("map", {
    center: [0, 0],
    zoom: 2,
  });

  // Add OSM basemap tiles
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  }).addTo(map);

  // Load external GeoJSON data
  getData(map);
}


// Create popup content for each GeoJSON feature
function onEachFeature(feature, layer) {

  // Initialize empty string to build popup HTML
  var popupContent = "";


  if (feature.properties) {
    for (var property in feature.properties) {    // Loop through all properties in the feature
      popupContent +=
        "<p>" + property + ": " + feature.properties[property] + "</p>";   // Append property name and value as paragraph
    }

    // Attach popup to the feature layer
    layer.bindPopup(popupContent);
  }
}



// Fetch external GeoJSON and add to map
function getData(map) {

  // Fetch GeoJSON file from data folder
  fetch("data/MegaCities.geojson")

    // Convert response to JSON format
    .then(function (response) {
      return response.json();
    })


    .then(function (json) {

      // Define styling options for point features
      var geojsonMarkerOptions = {
        radius: 8,              // circle size
        fillColor: "#ff7800",   // fill color
        color: "#000",          // outline color
        weight: 1,              // outline width
        opacity: 1,
        fillOpacity: 0.8,       // fill transparency
      };



      // Create a Leaflet GeoJSON layer
      L.geoJson(json, {

        // Convert GeoJSON Point features into circle markers
        pointToLayer: function (feature, latlng) {
          return L.circleMarker(latlng, geojsonMarkerOptions);
        },

        // Attach popup to each feature
        onEachFeature: onEachFeature,

      }).addTo(map); // Add the GeoJSON layer to the map
    });
}


// Run createMap()
document.addEventListener("DOMContentLoaded", createMap);