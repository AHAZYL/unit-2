// Global variables
var map;
var currentAttribute;
var propSymbols;          // L.geoJson layer
var geoData;              // stored GeoJSON
var attributesAll = [];   // list of year attributes
var globalMinValue = 1;   // global min across ALL years
var dataStats = {};       // {min,max,mean} for CURRENT year



// Create a popup, we instantiate a new PopupContent object,
function PopupContent(properties, attribute) {
  this.city = properties.name;
  this.attribute = attribute;
  this.hotDays = properties[attribute];

  // Format the popup
  this.formatted =
    "<p><b>City:</b> " + this.city + "</p>" +
    "<p><b>Hot days in " + this.attribute + ":</b> " + this.hotDays + "</p>";
}



// Define createMap() to create the Leaflet map
function createMap() {
  // Create map centered over the US and prevent endless drifting
  map = L.map("map", {
    center: [39, -98],
    zoom: 4,
    minZoom: 3,
    maxZoom: 7,
    maxBounds: [
      [15, -130],
      [55, -60]
    ],
    maxBoundsViscosity: 1.0
  });

  // Add CARTO dark basemap tiles
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(map);

  // Load GeoJSON
  getData();
}



// Scan the first feature's properties and extract only year fields
function processData(data) {
  var attributes = [];
  var properties = data.features[0].properties;

  for (var propName in properties) {

    if (/^\d{4}$/.test(propName)) attributes.push(propName);
  }

  // Sort years numerically
  attributes.sort(function (a, b) {
    return Number(a) - Number(b);
  });

  return attributes;
}



// Find the minimum value
function calcGlobalMinValue(data, attributes) {
  var allValues = [];

  for (var city of data.features) {
    for (var i = 0; i < attributes.length; i++) {
      var v = Number(city.properties[attributes[i]]);
      if (!Number.isNaN(v)) allValues.push(v);
    }
  }

  // Avoid invalid value
  var m = Math.min(...allValues);
  return (m <= 0 || !isFinite(m)) ? 1 : m;
}



// Calculates min, max, mean for one selected year
function calcStatsForAttribute(data, attribute) {
  var values = [];

  for (var city of data.features) {
    var v = Number(city.properties[attribute]);
    if (!Number.isNaN(v)) values.push(v);
  }

  var min = Math.min(...values);
  var max = Math.max(...values);
  var sum = values.reduce(function (a, b) { return a + b; }, 0);
  var mean = sum / values.length;

  return { min: min, max: max, mean: mean };
}



// Convert an attribute value into a circle radius
function calcPropRadius(attValue) {
  var minRadius = 3;

  // Avoid bad values
  if (!isFinite(attValue) || attValue <= 0) return minRadius;
  if (!globalMinValue || globalMinValue <= 0) return minRadius;

  // Flannery-style scaling
  return 1.0083 * Math.pow(attValue / globalMinValue, 0.5715) * minRadius;
}

// Define how legend numbers display
function formatLegendValue(v) {
  return Math.round(v);
}




// Convert each point feature into a styled circleMarker
function pointToLayer(feature, latlng) {
  // visual style for circles
  var options = {
    fillColor: "#ff6b6b",
    color: "#ffffff",
    weight: 1.5,
    opacity: 1,
    fillOpacity: 0.5
  };


  // Set radius based on current year value
  var attValue = Number(feature.properties[currentAttribute]);
  options.radius = calcPropRadius(attValue);

  // Create circle marker layer
  var layer = L.circleMarker(latlng, options);

  // Build popup content
  var popupContent = new PopupContent(feature.properties, currentAttribute);

  // Bind popup and offset it
  layer.bindPopup(popupContent.formatted, {
    offset: new L.Point(0, -options.radius)
  });

  return layer;
}


// Build the GeoJSON layer once and adds it to the map
function createPropSymbols(data) {
  propSymbols = L.geoJson(data, {
    pointToLayer: pointToLayer
  }).addTo(map);

  // Zoom map to include all symbols
  map.fitBounds(propSymbols.getBounds());
}





// Update symbols by year
function updatePropSymbols(attribute) {
  currentAttribute = attribute;

  // Update temporal legend year text
  var yearSpan = document.querySelector("#temporal-legend");
  if (yearSpan) yearSpan.textContent = attribute;

  // Recompute year-specific stats and redraw legend SVG
  if (geoData) {
    dataStats = calcStatsForAttribute(geoData, attribute);
    updateLegendGraphics();
  }

  if (!propSymbols) return;



  // Update each circle marker
  propSymbols.eachLayer(function (layer) {
    var props = layer.feature.properties;
    if (props[attribute] === undefined) return;

    var value = Number(props[attribute]);
    if (!isFinite(value)) return;

    // Update radius
    var radius = calcPropRadius(value);
    layer.setRadius(radius);

    // Update popup
    var popupContent = new PopupContent(props, attribute);

    if (layer.getPopup()) {
      layer.setPopupContent(popupContent.formatted);
      layer.getPopup().options.offset = new L.Point(0, -radius)


      // If popup is open, refresh it so user sees new content immediately
      if (layer.isPopupOpen()) layer.openPopup();
    } else {
      layer.bindPopup(popupContent.formatted, { offset: new L.Point(0, -radius) });
    }
  });
}




// Create a custom Leaflet control containing a slider and forward/back buttons
function createSequenceControls(attributes) {

  // Define a custom Leaflet control class
  var SequenceControl = L.Control.extend({
    options: { position: "bottomleft" },

    onAdd: function () {
      // Create container div that Leaflet will place in the map corner
      var container = L.DomUtil.create("div", "sequence-control-container");

      // Insert slider + buttons HTML into container
      container.insertAdjacentHTML(
        "beforeend",
        '<div class="sequence-ui">' +
          '<input class="range-slider" type="range" min="0" max="' + (attributes.length - 1) +
          '" value="0" step="1">' +
          '<div class="button-row">' +
            '<button class="step" id="reverse" title="Reverse">&#10094;</button>' +
            '<button class="step" id="forward" title="Forward">&#10095;</button>' +
          "</div>" +
        "</div>"
      );

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      return container;
    }
  });


  // Add control to the map
  map.addControl(new SequenceControl());

  // Attach event listeners AFTER the control exists in the DOM
  var slider = document.querySelector(".sequence-control-container .range-slider");



  // Forward/back buttons
  document.querySelectorAll(".sequence-control-container .step").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var index = Number(slider.value);

      if (btn.id === "forward") {
        index = (index + 1) > (attributes.length - 1) ? 0 : (index + 1);
      } else {
        index = (index - 1) < 0 ? (attributes.length - 1) : (index - 1);
      }

      slider.value = index;
      updatePropSymbols(attributes[index]);
    });
  });



  // Slider drag
  slider.addEventListener("input", function () {
    var index = Number(this.value);
    updatePropSymbols(attributes[index]);
  });
}



// Add a Leaflet control and insert it into the DOM
function createLegend(startAttribute) {
  var LegendControl = L.Control.extend({
    options: { position: "bottomright" },

    onAdd: function () {
      var container = L.DomUtil.create("div", "legend-control-container");

      container.innerHTML =
        '<div class="legend-title">Hot Days in <span class="year" id="temporal-legend">' +
        startAttribute +
        "</span></div>" +
        '<svg id="attribute-legend"></svg>';

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      return container;
    }
  });

  map.addControl(new LegendControl());


  // Draw AFTER the control is added to the map DOM
  setTimeout(function () {
    updateLegendGraphics();
  }, 0);
}


// Add a small narrative panel to explain why this map matters
function createIntroPanel() {
  var IntroControl = L.Control.extend({
    options: { position: "topleft" },

    onAdd: function () {
      var container = L.DomUtil.create("div", "intro-control-container");

      container.innerHTML =
        '<h2>Extreme Heat in U.S. Cities</h2>' +
        '<p>This map shows the number of hot days recorded in selected U.S. cities across multiple years.</p>' +
        '<p>By comparing circle sizes over time, users can explore how heat exposure changes from city to city and year to year.</p>' +
        '<p>This matters because increasing hot days can affect public health, urban livability, and climate resilience planning.</p>';

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      return container;
    }
  });

  map.addControl(new IntroControl());
}



// Redraw the SVG each time the year changes
function updateLegendGraphics() {
  var svg = document.querySelector("#attribute-legend");
  if (!svg) return;

  // Current-year stats
  var vMax = dataStats.max;
  var vMean = dataStats.mean;
  var vMin = dataStats.min;

  // SCaled for current year
  var rMax = calcPropRadius(vMax);
  var rMean = calcPropRadius(vMean);
  var rMin = calcPropRadius(vMin);


  var pad = 10;
  var circleCX = 55;
  var labelX = 205;

  // Vertical placement of number rows
  var labelTopY = pad + 22;
  var labelRowGap = 30;

  var bottomY = pad + rMax;
  bottomY += 50;

  var minBottomY = labelTopY + 2 * labelRowGap + 10;
  if (bottomY < minBottomY) bottomY = minBottomY;

  // SVG dimensions
  var svgW = 220;
  var svgH = bottomY + pad;

  svg.setAttribute("width", svgW);
  svg.setAttribute("height", svgH);
  svg.setAttribute("viewBox", "0 0 " + svgW + " " + svgH);

  // Clear and redraw all SVG elements each update
  svg.innerHTML = "";



  // Helper: add one circle + one label row
  function addCircleAndText(key, value, radius, rowIndex) {

    var cy = bottomY - radius;
    // Circle element
    svg.insertAdjacentHTML(
      "beforeend",
      '<circle class="legend-circle" id="' + key + '" ' +
        'r="' + radius + '" cx="' + circleCX + '" cy="' + cy + '" ' +
        'fill="#ff6b6b" fill-opacity="0.5" stroke="#ffffff" stroke-width="1.5" />'
    );


    // Text row y coordinate
    var textY = labelTopY + rowIndex * labelRowGap;

    // Label element
    svg.insertAdjacentHTML(
      "beforeend",
      '<text class="legend-text" id="' + key + '-text" ' +
        'x="' + labelX + '" y="' + textY + '">' +
        String(formatLegendValue(value)).trim() +
      "</text>"
    );
  }

  // Draw in order: max, mean, min
  addCircleAndText("max", vMax, rMax, 0);
  addCircleAndText("mean", vMean, rMean, 1);
  addCircleAndText("min", vMin, rMin, 2);
}


// Load GeoJSON
function getData() {
  fetch("data/US_Cities_Hot_Days.geojson")
    .then(function (response) { return response.json(); })
    .then(function (json) {
      geoData = json;

      // Extract year fields like
      attributesAll = processData(json);
      if (attributesAll.length === 0) {
        alert("No year attributes found. Check GeoJSON field names.");
        return;
      }


      // Set initial attribute to first year
      currentAttribute = attributesAll[0];

      // Compute global min across all years for stable scaling
      globalMinValue = calcGlobalMinValue(json, attributesAll);

      // Compute legend stats for initial year
      dataStats = calcStatsForAttribute(json, currentAttribute);

      // Build layers and UI
      createPropSymbols(json);
      createSequenceControls(attributesAll);
      createLegend(currentAttribute);
      createIntroPanel();

      // Force initial sync
      updatePropSymbols(currentAttribute);
    })
    .catch(function (err) {
      console.error(err);
      alert("Could not load GeoJSON. Check console + file path.");
    });
}


// Start once HTML is loaded
document.addEventListener("DOMContentLoaded", createMap);