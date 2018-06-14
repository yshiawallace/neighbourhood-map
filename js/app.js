// Global variables
var map,
	bounds,
	largeInfowindow;

// Initialize the Google map
function initMap() {
	map = new google.maps.Map(document.getElementById('map'), {
		center: {lat: 29.95106579999999, lng: -90.0715323},
		zoom: 13
	});

	bounds = new google.maps.LatLngBounds();
	largeInfowindow = new google.maps.InfoWindow();

	// Activate knockout.js
	ko.applyBindings(new ViewModel());
}

// Make API request to Foursquare and populate inforwindow with
// details from Foursquare
function populateInfoWindow(marker, recommender, infowindow) {
	var client_id = "4RMAEP0EFWK4HZP3DNANSDPSKZK3JPZOUQVPZCNSOTAQRLVG";
	var client_secret = "GNNZHIBVMIDNBX5RJLUKHZAJ51DHCUVWN4DX0U0BPNQSKVI2";
	var venueName = marker.title;
	var recommender = recommender;
	var formattedVenueName = venueName.split(' ').join('+');

	var foursquareApiRequest = "https://api.foursquare.com/v2/venues/explore?v=20170801&client_id=" + client_id +
	"&client_secret=" + client_secret + "&ll=" + marker.lat + ',' + marker.lng + "&query=" + formattedVenueName;
	
	// Reference: https://davidwalsh.name/write-javascript-promises
	// Make initial API request to retrieve the Foursquare venue ID
	// which is needed to make a venue details request
	$.getJSON(foursquareApiRequest).done(function(data) {
		var venueId = data.response.groups[0].items[0].venue.id;
		var foursquareVenueRequest = "https://api.foursquare.com/v2/venues/" + venueId +
			"?v=20170801&client_id=" + client_id +
			"&client_secret=" + client_secret;

		// Make venue details request to retrieve address, website, and photo for the infowindow
		$.getJSON(foursquareVenueRequest).done(function(data) {
			var venueData = data.response.venue;
			var address = venueData.location.address;
			var city = venueData.location.city;
			var state = venueData.location.state;
			var postalCode = venueData.location.postalCode;
			var website = venueData.url;
			var photos = venueData.photos.groups;

			if (infowindow.marker != marker) {

				// Output the content for the input window
				function buildContentString() {
					var contentString = '';
					contentString += '<h3 class="venue-title">' + venueName + '</h3>';
					contentString += '<p class="venue-address">' + address + '<br>' + city + ', ' + state + ' ' + postalCode + '</p>';
					if (recommender) {
						contentString += '<p class="venue-recommender">Recommended by: <strong>' + recommender + '</strong></p>';
					}
					if (website) {
						contentString += '<a class="venue-website" href="' + website + '" target="_blank">' + website + '</a>';
					}
					if (typeof photos !== 'undefined' && photos.length > 0) {
						var photoPrefix = photos[0].items[0].prefix;
						var photoSufix = photos[0].items[0].suffix;
						contentString += '<img class="venue-img" src="' + photoPrefix + '150x150'+ photoSufix +'">';
					}
					return contentString;
				}

				infowindow.marker = marker;
				infowindow.setContent(buildContentString());
				infowindow.open(map, marker);
				// Make sure the marker property is cleared if the infowindow is closed.
				infowindow.addListener('closeclick',function(){
					infowindow.setMarker = null;
				});
			}
		}).fail(function() {
			console.log('Your Foursquare API request failed.');
		});
	}).fail(function() {
		console.log('Your Foursquare API request failed.');
	});
}

function toggleMobileMenu() {
	var sidebar = $('main aside');
	var nav = $('.header .nav__icn');
	nav.toggleClass('open');
	sidebar.toggleClass('open');
}
var navIcon = $('.header .nav');
navIcon.on('click', toggleMobileMenu);


/* =================
 Location Model 
==================== */

function Location(data) {
	var self = this;

	this.name = data.name;
	this.recommender = data.recommender;
	this.isFiltered = ko.observable(false);

	this.marker = new google.maps.Marker({
		map: map,
		position: data.geolocation,
		title: data.name,
		animation: google.maps.Animation.DROP,
		lat: data.geolocation.lat,
		lng: data.geolocation.lng
	});

	this.marker.addListener('click', function() {
		self.marker.setAnimation(google.maps.Animation.BOUNCE);
    	setTimeout(function(){ self.marker.setAnimation(null); }, 750);
		populateInfoWindow(this, self.recommender, largeInfowindow);
	});
}

/* =================
 ViewModel 
==================== */

var ViewModel = function() {
	var self = this;

	// Create observable array for the location filter input field
	this.locationSearch = ko.observable('');

	// Create observable array for locations
	this.locationsList = ko.observableArray([]);

	// Push all the initial locations from data.js to the locationsList observableArray
	locations.forEach(function(location) {
		self.locationsList.push(new Location(location));	
	});

	// Filter locations based on text input results
	this.filteredLocations = ko.computed(function() {
		var searchTerm = self.locationSearch().toLowerCase();
		// Only show locations that include the search input value
		if (searchTerm) {
			return ko.utils.arrayFilter(self.locationsList(), function(location) {
				result = location.name.toLowerCase().includes(searchTerm);
				location.isFiltered(result);
				// Only display the markers for the filtered locations,
				// and re-draw the map to fit the new bounds
				if (location.isFiltered() === true) {
					location.marker.setMap(map);
					bounds.extend(location.marker.position);
					map.fitBounds(bounds);
				} else {
					location.marker.setMap(null);
				}
				return result;
			});
		} else {
			// if there is not inout value, re-draw the map to
			// include all locations in the locationsList array
			self.locationsList().forEach(function(location) {
				location.marker.setMap(map);
				bounds.extend(location.marker.position);
				map.fitBounds(bounds);
			});
			return self.locationsList();
		}
	}, self);

	// Trigger the infowindow to open when you click on it's list item
	// Reference: https://stackoverflow.com/questions/2730929/how-to-trigger-the-onclick-event-of-a-marker-on-a-google-maps-v3
	this.openInfoWindow = function(location) {
		google.maps.event.trigger(location.marker, 'click');
	}

	// 
	this.clearInputField = function() {
		this.locationSearch('');
	}
}
