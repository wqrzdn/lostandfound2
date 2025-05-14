// Location Data Helper for Lost and Found application

// Geolocation functionality
const geolocation = {
  // Get current position
  getCurrentPosition: function(successCallback, errorCallback) {
    if (!navigator.geolocation) {
      if (errorCallback) errorCallback({
        code: 0,
        message: 'Geolocation is not supported by your browser'
      });
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      position => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        if (successCallback) successCallback(coords);
      },
      error => {
        if (errorCallback) errorCallback(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  },
  
  // Reverse geocode to get address from coordinates
  reverseGeocode: async function(latitude, longitude) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  }
};

// Common states/provinces data for fallback
const commonStatesData = {
  'US': [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' },
    { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' },
    { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' },
    { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' },
    { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' },
    { code: 'WY', name: 'Wyoming' },
    { code: 'DC', name: 'District of Columbia' }
  ],
  'IN': [
    { code: 'AP', name: 'Andhra Pradesh' },
    { code: 'AR', name: 'Arunachal Pradesh' },
    { code: 'AS', name: 'Assam' },
    { code: 'BR', name: 'Bihar' },
    { code: 'CT', name: 'Chhattisgarh' },
    { code: 'GA', name: 'Goa' },
    { code: 'GJ', name: 'Gujarat' },
    { code: 'HR', name: 'Haryana' },
    { code: 'HP', name: 'Himachal Pradesh' },
    { code: 'JK', name: 'Jammu and Kashmir' },
    { code: 'JH', name: 'Jharkhand' },
    { code: 'KA', name: 'Karnataka' },
    { code: 'KL', name: 'Kerala' },
    { code: 'MP', name: 'Madhya Pradesh' },
    { code: 'MH', name: 'Maharashtra' },
    { code: 'MN', name: 'Manipur' },
    { code: 'ML', name: 'Meghalaya' },
    { code: 'MZ', name: 'Mizoram' },
    { code: 'NL', name: 'Nagaland' },
    { code: 'OR', name: 'Odisha' },
    { code: 'PB', name: 'Punjab' },
    { code: 'RJ', name: 'Rajasthan' },
    { code: 'SK', name: 'Sikkim' },
    { code: 'TN', name: 'Tamil Nadu' },
    { code: 'TG', name: 'Telangana' },
    { code: 'TR', name: 'Tripura' },
    { code: 'UT', name: 'Uttarakhand' },
    { code: 'UP', name: 'Uttar Pradesh' },
    { code: 'WB', name: 'West Bengal' }
  ],
  'CA': [
    { code: 'AB', name: 'Alberta' },
    { code: 'BC', name: 'British Columbia' },
    { code: 'MB', name: 'Manitoba' },
    { code: 'NB', name: 'New Brunswick' },
    { code: 'NL', name: 'Newfoundland and Labrador' },
    { code: 'NS', name: 'Nova Scotia' },
    { code: 'ON', name: 'Ontario' },
    { code: 'PE', name: 'Prince Edward Island' },
    { code: 'QC', name: 'Quebec' },
    { code: 'SK', name: 'Saskatchewan' },
    { code: 'NT', name: 'Northwest Territories' },
    { code: 'NU', name: 'Nunavut' },
    { code: 'YT', name: 'Yukon' }
  ],
  'GB': [
    { code: 'ENG', name: 'England' },
    { code: 'SCT', name: 'Scotland' },
    { code: 'WLS', name: 'Wales' },
    { code: 'NIR', name: 'Northern Ireland' }
  ],
  'AU': [
    { code: 'ACT', name: 'Australian Capital Territory' },
    { code: 'NSW', name: 'New South Wales' },
    { code: 'NT', name: 'Northern Territory' },
    { code: 'QLD', name: 'Queensland' },
    { code: 'SA', name: 'South Australia' },
    { code: 'TAS', name: 'Tasmania' },
    { code: 'VIC', name: 'Victoria' },
    { code: 'WA', name: 'Western Australia' }
  ]
};

// Sample countries data for fallback
const countriesData = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'IN', name: 'India' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ES', name: 'Spain' },
  { code: 'RU', name: 'Russia' },
  { code: 'ZA', name: 'South Africa' }
];

// Helper function to populate countries dropdown
function populateCountries(selectElement) {
  if (!selectElement) return;
  
  // Clear existing options
  selectElement.innerHTML = '<option value="" selected disabled>Select a country</option>';
  
  // Add countries
  countriesData.forEach(country => {
    const option = document.createElement('option');
    option.value = country.name;
    option.dataset.code = country.code;
    option.textContent = country.name;
    selectElement.appendChild(option);
  });
  
  // Enable the select
  selectElement.disabled = false;
}

// Helper function to populate states dropdown based on country
function populateStates(stateSelect, countryCode) {
  if (!stateSelect) return;
  
  // Clear existing options
  stateSelect.innerHTML = '<option value="" selected disabled>Select a state/province</option>';
  
  // Check if we have data for this country
  if (commonStatesData[countryCode]) {
    // Add states
    commonStatesData[countryCode].forEach(state => {
      const option = document.createElement('option');
      option.value = state.name;
      option.dataset.code = state.code;
      option.textContent = state.name;
      stateSelect.appendChild(option);
    });
    
    // Enable the select
    stateSelect.disabled = false;
  } else {
    // If no data, keep disabled
    stateSelect.disabled = true;
  }
}

// Helper function to populate location fields based on geolocation data
async function populateLocationFromGeolocation(countrySelect, stateSelect, cityInput, locationInput) {
  return new Promise((resolve, reject) => {
    // Show loading indicator or message
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'geolocation-loading';
    loadingMessage.className = 'alert alert-info mt-2';
    loadingMessage.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Detecting your location...';
    
    // Add loading message after the location fields section
    const locationFields = document.querySelector('.location-fields');
    if (locationFields) {
      locationFields.appendChild(loadingMessage);
    }
    
    // Get current position
    geolocation.getCurrentPosition(
      async (coords) => {
        try {
          // Reverse geocode to get address
          const geoData = await geolocation.reverseGeocode(coords.latitude, coords.longitude);
          
          if (geoData && geoData.address) {
            const address = geoData.address;
            
            // Find and select country
            if (address.country && countrySelect) {
              for (let i = 0; i < countrySelect.options.length; i++) {
                if (countrySelect.options[i].textContent === address.country) {
                  countrySelect.selectedIndex = i;
                  // Trigger change event to load states
                  const event = new Event('change');
                  countrySelect.dispatchEvent(event);
                  break;
                }
              }
              
              // Wait for states to load
              setTimeout(() => {
                // Find and select state/province
                if ((address.state || address.province) && stateSelect) {
                  const stateName = address.state || address.province;
                  for (let i = 0; i < stateSelect.options.length; i++) {
                    if (stateSelect.options[i].textContent === stateName) {
                      stateSelect.selectedIndex = i;
                      // Trigger change event
                      const event = new Event('change');
                      stateSelect.dispatchEvent(event);
                      break;
                    }
                  }
                }
                
                // Set city using custom input if available
                if (address.city || address.town || address.village) {
                  const cityName = address.city || address.town || address.village;
                  
                  // If we have a city search input and button
                  const citySearchInput = document.getElementById('citySearch');
                  const saveCitySearchBtn = document.getElementById('saveCitySearch');
                  
                  if (citySearchInput && saveCitySearchBtn) {
                    citySearchInput.value = cityName;
                    saveCitySearchBtn.click();
                  } else if (cityInput) {
                    // Direct input to city field if it's a regular input
                    cityInput.value = cityName;
                  }
                }
                
                // Add specific location details
                if (locationInput && (address.road || address.neighbourhood)) {
                  let locationDetails = '';
                  if (address.road) locationDetails += address.road;
                  if (address.neighbourhood) {
                    if (locationDetails) locationDetails += ', ';
                    locationDetails += address.neighbourhood;
                  }
                  locationInput.value = locationDetails;
                }
                
                // Remove loading message
                const loadingMsg = document.getElementById('geolocation-loading');
                if (loadingMsg) loadingMsg.remove();
                
                resolve({
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  address: geoData.address
                });
              }, 500); // Give time for states to load
            } else {
              // Remove loading message
              const loadingMsg = document.getElementById('geolocation-loading');
              if (loadingMsg) loadingMsg.remove();
              
              reject('Country not found in the dropdown');
            }
          } else {
            // Remove loading message
            const loadingMsg = document.getElementById('geolocation-loading');
            if (loadingMsg) loadingMsg.remove();
            
            reject('Could not determine address from coordinates');
          }
        } catch (error) {
          // Remove loading message
          const loadingMsg = document.getElementById('geolocation-loading');
          if (loadingMsg) loadingMsg.remove();
          
          console.error('Error in reverse geocoding:', error);
          reject(error);
        }
      },
      (error) => {
        // Remove loading message
        const loadingMsg = document.getElementById('geolocation-loading');
        if (loadingMsg) loadingMsg.remove();
        
        let errorMessage = 'Error getting your location';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access was denied by the user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'The request to get location timed out';
            break;
        }
        
        // Show error message
        const errorAlert = document.createElement('div');
        errorAlert.className = 'alert alert-warning mt-2';
        errorAlert.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> ${errorMessage}`;
        errorAlert.style.transition = 'opacity 0.5s';
        
        const locationFields = document.querySelector('.location-fields');
        if (locationFields) {
          locationFields.appendChild(errorAlert);
          
          // Remove error message after 5 seconds
          setTimeout(() => {
            errorAlert.style.opacity = '0';
            setTimeout(() => errorAlert.remove(), 500);
          }, 5000);
        }
        
        reject(errorMessage);
      }
    );
  });
}
