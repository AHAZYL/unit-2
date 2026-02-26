// Declare map variable globally so all functions have access
var map;

// Global variables for proportional symbol scaling
var minValue;
var currentAttribute; // changes as the user sequences

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
  getData();
}



// Build an array of year attributes (from 2015 to 2021)
function processData(data) {
  var attributes = [];
  var properties = data.features[0].properties;

  for (var propName in properties) {
    if (/^\d{4}$/.test(propName)) {    // keep only 4-digit years
      attributes.push(propName);
    }
  }

  // Make sure they’re in order
  attributes.sort(function(a, b) {
    return Number(a) - Number(b);
  });

  console.log("Attributes:", attributes);
  return attributes;
}



// Find the minimum value across all year attributes
function calculateMinValueAll(data, attributes) {
  var allValues = [];

  for (var city of data.features) {
    for (var i = 0; i < attributes.length; i++) {
      var yr = attributes[i];
      var value = Number(city.properties[yr]);
      if (!Number.isNaN(value)) {
        allValues.push(value);
      }
    }
  }

  return Math.min(...allValues);
}


// Converts attribute value to symbol radius
function calcPropRadius(attValue) {
  var minRadius = 3; // adjust to taste
  var radius = 1.0083 * Math.pow(attValue / minValue, 0.5715) * minRadius;
  return radius;
}


// Convert GeoJSON points into proportional circle markers and popups
function pointToLayer(feature, latlng) {
  // marker style options
  var options = {
    fillColor: "#ff6b6b",
    color: "#ffffff",
    weight: 1.5,
    opacity: 1,
    fillOpacity: 0.5
  };



  // value for the current attribute
  var attValue = Number(feature.properties[currentAttribute]);

  // radius based on value
  options.radius = calcPropRadius(attValue);

  // create circle marker
  var layer = L.circleMarker(latlng, options);

  // retrieve popup content
  var popupContent =
    "<p><b>City:</b> " + feature.properties.name + "</p>" +
    "<p><b>Hot days in " + currentAttribute + ":</b> " + feature.properties[currentAttribute] + "</p>";

  // offset popup so it doesn't cover symbol
  layer.bindPopup(popupContent, {
    offset: new L.Point(0, -options.radius)
  });

  return layer;
}



// Create proportional symbols layer
function createPropSymbols(data) {
  var geoLayer = L.geoJson(data, {
    pointToLayer: pointToLayer
  }).addTo(map);

  map.fitBounds(geoLayer.getBounds());
}




// Update symbols and popups when attribute changes
function updatePropSymbols(attribute) {
  currentAttribute = attribute;

  map.eachLayer(function(layer) {
    if (layer.feature && layer.feature.properties[attribute] !== undefined) {
      var props = layer.feature.properties;

      // update radius
      var radius = calcPropRadius(Number(props[attribute]));
      layer.setRadius(radius);

      // update popup content
      var popupContent =
        "<p><b>City:</b> " + props.name + "</p>" +
        "<p><b>Hot days in " + attribute + ":</b> " + props[attribute] + "</p>";

      layer.bindPopup(popupContent, {
        offset: new L.Point(0, -radius)
      });

      // refresh popup if open
      if (layer.getPopup()) {
        layer.getPopup().setContent(popupContent);
      }
    }
  });
}




// Create slider, step buttons and listeners
function createSequenceControls(attributes) {
  var panel = document.querySelector("#panel");

  // Replace panel content with controls
  panel.innerHTML = `
  <input class="range-slider" type="range" min="0" max="${attributes.length - 1}" value="0" step="1">
  <div class="button-row">
    <button class="step" id="reverse">&#10094;</button>
    <button class="step" id="forward">&#10095;</button>
  </div>
`;

  // Step buttons
  document.querySelectorAll(".step").forEach(function(step) {
    step.addEventListener("click", function() {
      var index = Number(document.querySelector(".range-slider").value);

      if (step.id === "forward") {
        index++;
        index = index > attributes.length - 1 ? 0 : index;
      } else {
        index--;
        index = index < 0 ? attributes.length - 1 : index;
      }

      document.querySelector(".range-slider").value = index;
      updatePropSymbols(attributes[index]);
    });
  });


  // Slider
  document.querySelector(".range-slider").addEventListener("input", function() {
    var index = Number(this.value);
    updatePropSymbols(attributes[index]);
  });
}




// Load GeoJSON data
function getData() {
  fetch("data/US_Cities_Hot_Days.geojson")
    .then(function(response) {
      return response.json();
    })
    .then(function(json) {
      // build the attributes array (years)
      var attributes = processData(json);

      if (attributes.length === 0) {
        alert("No year attributes found. Check GeoJSON field names.");
        return;
      }

      // set starting attribute to first year
      currentAttribute = attributes[0];

      // compute min for Flannery scaling across all years
      minValue = calculateMinValueAll(json, attributes);

      // create symbols for starting year
      createPropSymbols(json);

      // create slider + buttons
      createSequenceControls(attributes);
    })
    .catch(function(err) {
      console.error(err);
      alert("Could not load GeoJSON. Check console + file path.");
    });
}


// Run createMap()
document.addEventListener("DOMContentLoaded", createMap);