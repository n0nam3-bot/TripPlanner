export type LocationSuggestion = {
  value: string;
  label: string;
  detail: string;
  kind: "city" | "area" | "airport" | "region" | "attraction";
  airportCode: string;
  country: string;
};


export type USState = { name: string; abbreviation: string; airports: Array<{ code: string; city: string }> };

// State-level destination support. Gateway airports are choices for flight searches;
// hotel and activity searches continue to use the full state as the destination.
export const US_STATES: USState[] = [
  { name: "Alabama", abbreviation: "AL", airports: [{ code: "BHM", city: "Birmingham" }, { code: "MOB", city: "Mobile" }] },
  { name: "Alaska", abbreviation: "AK", airports: [{ code: "ANC", city: "Anchorage" }, { code: "FAI", city: "Fairbanks" }] },
  { name: "Arizona", abbreviation: "AZ", airports: [{ code: "PHX", city: "Phoenix" }, { code: "TUS", city: "Tucson" }] },
  { name: "Arkansas", abbreviation: "AR", airports: [{ code: "LIT", city: "Little Rock" }] },
  { name: "California", abbreviation: "CA", airports: [{ code: "LAX", city: "Los Angeles" }, { code: "SFO", city: "San Francisco" }, { code: "SAN", city: "San Diego" }, { code: "SMF", city: "Sacramento" }] },
  { name: "Colorado", abbreviation: "CO", airports: [{ code: "DEN", city: "Denver" }, { code: "COS", city: "Colorado Springs" }] },
  { name: "Connecticut", abbreviation: "CT", airports: [{ code: "BDL", city: "Hartford" }] },
  { name: "Delaware", abbreviation: "DE", airports: [{ code: "ILG", city: "Wilmington" }] },
  { name: "Florida", abbreviation: "FL", airports: [{ code: "MIA", city: "Miami" }, { code: "MCO", city: "Orlando" }, { code: "TPA", city: "Tampa" }, { code: "FLL", city: "Fort Lauderdale" }] },
  { name: "Georgia", abbreviation: "GA", airports: [{ code: "ATL", city: "Atlanta" }, { code: "SAV", city: "Savannah" }] },
  { name: "Hawaii", abbreviation: "HI", airports: [{ code: "HNL", city: "Honolulu" }, { code: "OGG", city: "Kahului" }] },
  { name: "Idaho", abbreviation: "ID", airports: [{ code: "BOI", city: "Boise" }] },
  { name: "Illinois", abbreviation: "IL", airports: [{ code: "ORD", city: "Chicago O’Hare" }, { code: "MDW", city: "Chicago Midway" }] },
  { name: "Indiana", abbreviation: "IN", airports: [{ code: "IND", city: "Indianapolis" }] },
  { name: "Iowa", abbreviation: "IA", airports: [{ code: "DSM", city: "Des Moines" }] },
  { name: "Kansas", abbreviation: "KS", airports: [{ code: "ICT", city: "Wichita" }] },
  { name: "Kentucky", abbreviation: "KY", airports: [{ code: "SDF", city: "Louisville" }, { code: "LEX", city: "Lexington" }] },
  { name: "Louisiana", abbreviation: "LA", airports: [{ code: "MSY", city: "New Orleans" }, { code: "BTR", city: "Baton Rouge" }] },
  { name: "Maine", abbreviation: "ME", airports: [{ code: "PWM", city: "Portland" }] },
  { name: "Maryland", abbreviation: "MD", airports: [{ code: "BWI", city: "Baltimore" }] },
  { name: "Massachusetts", abbreviation: "MA", airports: [{ code: "BOS", city: "Boston" }] },
  { name: "Michigan", abbreviation: "MI", airports: [{ code: "DTW", city: "Detroit" }, { code: "GRR", city: "Grand Rapids" }] },
  { name: "Minnesota", abbreviation: "MN", airports: [{ code: "MSP", city: "Minneapolis–Saint Paul" }] },
  { name: "Mississippi", abbreviation: "MS", airports: [{ code: "JAN", city: "Jackson" }] },
  { name: "Missouri", abbreviation: "MO", airports: [{ code: "STL", city: "St. Louis" }, { code: "MCI", city: "Kansas City" }] },
  { name: "Montana", abbreviation: "MT", airports: [{ code: "BZN", city: "Bozeman" }, { code: "BIL", city: "Billings" }] },
  { name: "Nebraska", abbreviation: "NE", airports: [{ code: "OMA", city: "Omaha" }, { code: "LNK", city: "Lincoln" }] },
  { name: "Nevada", abbreviation: "NV", airports: [{ code: "LAS", city: "Las Vegas" }, { code: "RNO", city: "Reno" }] },
  { name: "New Hampshire", abbreviation: "NH", airports: [{ code: "MHT", city: "Manchester" }] },
  { name: "New Jersey", abbreviation: "NJ", airports: [{ code: "EWR", city: "Newark" }, { code: "ACY", city: "Atlantic City" }] },
  { name: "New Mexico", abbreviation: "NM", airports: [{ code: "ABQ", city: "Albuquerque" }] },
  { name: "New York", abbreviation: "NY", airports: [{ code: "JFK", city: "New York JFK" }, { code: "LGA", city: "New York LaGuardia" }, { code: "BUF", city: "Buffalo" }, { code: "ROC", city: "Rochester" }] },
  { name: "North Carolina", abbreviation: "NC", airports: [{ code: "CLT", city: "Charlotte" }, { code: "RDU", city: "Raleigh–Durham" }] },
  { name: "North Dakota", abbreviation: "ND", airports: [{ code: "FAR", city: "Fargo" }] },
  { name: "Ohio", abbreviation: "OH", airports: [{ code: "CLE", city: "Cleveland" }, { code: "CMH", city: "Columbus" }, { code: "CVG", city: "Cincinnati" }] },
  { name: "Oklahoma", abbreviation: "OK", airports: [{ code: "OKC", city: "Oklahoma City" }, { code: "TUL", city: "Tulsa" }] },
  { name: "Oregon", abbreviation: "OR", airports: [{ code: "PDX", city: "Portland" }] },
  { name: "Pennsylvania", abbreviation: "PA", airports: [{ code: "PHL", city: "Philadelphia" }, { code: "PIT", city: "Pittsburgh" }, { code: "AVP", city: "Wilkes-Barre/Scranton" }, { code: "ABE", city: "Allentown" }] },
  { name: "Rhode Island", abbreviation: "RI", airports: [{ code: "PVD", city: "Providence" }] },
  { name: "South Carolina", abbreviation: "SC", airports: [{ code: "CHS", city: "Charleston" }, { code: "GSP", city: "Greenville–Spartanburg" }] },
  { name: "South Dakota", abbreviation: "SD", airports: [{ code: "FSD", city: "Sioux Falls" }] },
  { name: "Tennessee", abbreviation: "TN", airports: [{ code: "BNA", city: "Nashville" }, { code: "MEM", city: "Memphis" }] },
  { name: "Texas", abbreviation: "TX", airports: [{ code: "DFW", city: "Dallas–Fort Worth" }, { code: "IAH", city: "Houston" }, { code: "AUS", city: "Austin" }, { code: "SAT", city: "San Antonio" }] },
  { name: "Utah", abbreviation: "UT", airports: [{ code: "SLC", city: "Salt Lake City" }] },
  { name: "Vermont", abbreviation: "VT", airports: [{ code: "BTV", city: "Burlington" }] },
  { name: "Virginia", abbreviation: "VA", airports: [{ code: "IAD", city: "Washington Dulles" }, { code: "RIC", city: "Richmond" }, { code: "ORF", city: "Norfolk" }] },
  { name: "Washington", abbreviation: "WA", airports: [{ code: "SEA", city: "Seattle" }, { code: "GEG", city: "Spokane" }] },
  { name: "West Virginia", abbreviation: "WV", airports: [{ code: "CRW", city: "Charleston" }] },
  { name: "Wisconsin", abbreviation: "WI", airports: [{ code: "MKE", city: "Milwaukee" }, { code: "MSN", city: "Madison" }] },
  { name: "Wyoming", abbreviation: "WY", airports: [{ code: "JAC", city: "Jackson" }, { code: "CPR", city: "Casper" }] },
  { name: "District of Columbia", abbreviation: "DC", airports: [{ code: "DCA", city: "Washington National" }, { code: "IAD", city: "Washington Dulles" }] },
];

const COUNTRY_NAMES = [
  "Aruba",
  "Afghanistan",
  "Angola",
  "Anguilla",
  "Åland Islands",
  "Albania",
  "Andorra",
  "United Arab Emirates",
  "Argentina",
  "Armenia",
  "American Samoa",
  "French Southern Territories",
  "Antigua and Barbuda",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Burundi",
  "Belgium",
  "Benin",
  "Bonaire, Sint Eustatius and Saba",
  "Burkina Faso",
  "Bangladesh",
  "Bulgaria",
  "Bahrain",
  "Bahamas",
  "Bosnia and Herzegovina",
  "Saint Barthélemy",
  "Belarus",
  "Belize",
  "Bermuda",
  "Bolivia",
  "Bolivia, Plurinational State of",
  "Brazil",
  "Barbados",
  "Brunei Darussalam",
  "Bhutan",
  "Bouvet Island",
  "Botswana",
  "Central African Republic",
  "Canada",
  "Cocos (Keeling) Islands",
  "Switzerland",
  "Chile",
  "China",
  "Côte d'Ivoire",
  "Cameroon",
  "Congo, The Democratic Republic of the",
  "Congo",
  "Cook Islands",
  "Colombia",
  "Comoros",
  "Cabo Verde",
  "Costa Rica",
  "Cuba",
  "Curaçao",
  "Christmas Island",
  "Cayman Islands",
  "Cyprus",
  "Czechia",
  "Germany",
  "Djibouti",
  "Dominica",
  "Denmark",
  "Dominican Republic",
  "Algeria",
  "Ecuador",
  "Egypt",
  "Eritrea",
  "Western Sahara",
  "Spain",
  "Estonia",
  "Ethiopia",
  "Finland",
  "Fiji",
  "Falkland Islands (Malvinas)",
  "France",
  "Faroe Islands",
  "Micronesia, Federated States of",
  "Gabon",
  "United Kingdom",
  "Georgia",
  "Guernsey",
  "Ghana",
  "Gibraltar",
  "Guinea",
  "Guadeloupe",
  "Gambia",
  "Guinea-Bissau",
  "Equatorial Guinea",
  "Greece",
  "Grenada",
  "Greenland",
  "Guatemala",
  "French Guiana",
  "Guam",
  "Guyana",
  "Hong Kong",
  "Heard Island and McDonald Islands",
  "Honduras",
  "Croatia",
  "Haiti",
  "Hungary",
  "Indonesia",
  "Isle of Man",
  "India",
  "British Indian Ocean Territory",
  "Ireland",
  "Iran",
  "Iran, Islamic Republic of",
  "Iraq",
  "Iceland",
  "Israel",
  "Italy",
  "Jamaica",
  "Jersey",
  "Jordan",
  "Japan",
  "Kazakhstan",
  "Kenya",
  "Kyrgyzstan",
  "Cambodia",
  "Kiribati",
  "Saint Kitts and Nevis",
  "South Korea",
  "Korea, Republic of",
  "Kuwait",
  "Laos",
  "Lao People's Democratic Republic",
  "Lebanon",
  "Liberia",
  "Libya",
  "Saint Lucia",
  "Liechtenstein",
  "Sri Lanka",
  "Lesotho",
  "Lithuania",
  "Luxembourg",
  "Latvia",
  "Macao",
  "Saint Martin (French part)",
  "Morocco",
  "Monaco",
  "Moldova",
  "Moldova, Republic of",
  "Madagascar",
  "Maldives",
  "Mexico",
  "Marshall Islands",
  "North Macedonia",
  "Mali",
  "Malta",
  "Myanmar",
  "Montenegro",
  "Mongolia",
  "Northern Mariana Islands",
  "Mozambique",
  "Mauritania",
  "Montserrat",
  "Martinique",
  "Mauritius",
  "Malawi",
  "Malaysia",
  "Mayotte",
  "Namibia",
  "New Caledonia",
  "Niger",
  "Norfolk Island",
  "Nigeria",
  "Nicaragua",
  "Niue",
  "Netherlands",
  "Norway",
  "Nepal",
  "Nauru",
  "New Zealand",
  "Oman",
  "Pakistan",
  "Panama",
  "Pitcairn",
  "Peru",
  "Philippines",
  "Palau",
  "Papua New Guinea",
  "Poland",
  "Puerto Rico",
  "North Korea",
  "Korea, Democratic People's Republic of",
  "Portugal",
  "Paraguay",
  "Palestine, State of",
  "French Polynesia",
  "Qatar",
  "Réunion",
  "Romania",
  "Russian Federation",
  "Rwanda",
  "Saudi Arabia",
  "Sudan",
  "Senegal",
  "Singapore",
  "South Georgia and the South Sandwich Islands",
  "Saint Helena, Ascension and Tristan da Cunha",
  "Svalbard and Jan Mayen",
  "Solomon Islands",
  "Sierra Leone",
  "El Salvador",
  "San Marino",
  "Somalia",
  "Saint Pierre and Miquelon",
  "Serbia",
  "South Sudan",
  "Sao Tome and Principe",
  "Suriname",
  "Slovakia",
  "Slovenia",
  "Sweden",
  "Eswatini",
  "Sint Maarten (Dutch part)",
  "Seychelles",
  "Syria",
  "Syrian Arab Republic",
  "Turks and Caicos Islands",
  "Chad",
  "Togo",
  "Thailand",
  "Tajikistan",
  "Tokelau",
  "Turkmenistan",
  "Timor-Leste",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Türkiye",
  "Tuvalu",
  "Taiwan",
  "Taiwan, Province of China",
  "Tanzania",
  "Tanzania, United Republic of",
  "Uganda",
  "Ukraine",
  "United States Minor Outlying Islands",
  "Uruguay",
  "United States",
  "Uzbekistan",
  "Holy See (Vatican City State)",
  "Saint Vincent and the Grenadines",
  "Venezuela",
  "Venezuela, Bolivarian Republic of",
  "Virgin Islands, British",
  "Virgin Islands, U.S.",
  "Vietnam",
  "Viet Nam",
  "Vanuatu",
  "Wallis and Futuna",
  "Samoa",
  "Yemen",
  "South Africa",
  "Zambia",
  "Zimbabwe",
  "Turkey",
  "Czech Republic",
  "Republic of Korea",
  "Republic of the Congo",
  "Democratic Republic of the Congo",
  "The Gambia",
  "East Timor",
  "Ivory Coast",
  "Swaziland",
  "Macedonia"
];

const DESTINATION_LOCATIONS: LocationSuggestion[] = [
  { value: "Lisbon, Portugal", label: "Lisbon", detail: "Portugal · Humberto Delgado Airport", kind: "city", airportCode: "LIS", country: "Portugal" },
  { value: "Cancún, Mexico", label: "Cancún", detail: "Mexico · Cancún International Airport", kind: "city", airportCode: "CUN", country: "Mexico" },
  { value: "Mexico City, Mexico", label: "Mexico City", detail: "Mexico · Mexico City International Airport", kind: "city", airportCode: "MEX", country: "Mexico" },
  { value: "Punta Cana, Dominican Republic", label: "Punta Cana", detail: "Dominican Republic · Punta Cana International Airport", kind: "city", airportCode: "PUJ", country: "Dominican Republic" },
  { value: "Santo Domingo, Dominican Republic", label: "Santo Domingo", detail: "Dominican Republic · Las Américas International Airport", kind: "city", airportCode: "SDQ", country: "Dominican Republic" },
  { value: "Puerto Plata, Dominican Republic", label: "Puerto Plata", detail: "Dominican Republic · Gregorio Luperón International Airport", kind: "city", airportCode: "POP", country: "Dominican Republic" },
  { value: "Santiago de los Caballeros, Dominican Republic", label: "Santiago de los Caballeros", detail: "Dominican Republic · Cibao International Airport", kind: "city", airportCode: "STI", country: "Dominican Republic" },
  { value: "La Romana, Dominican Republic", label: "La Romana", detail: "Dominican Republic · La Romana International Airport", kind: "city", airportCode: "LRM", country: "Dominican Republic" },
  { value: "Bávaro, Punta Cana, Dominican Republic", label: "Bávaro", detail: "Punta Cana resort area · Dominican Republic · PUJ", kind: "area", airportCode: "PUJ", country: "Dominican Republic" },
  { value: "Cap Cana, Punta Cana, Dominican Republic", label: "Cap Cana", detail: "Punta Cana resort area · Dominican Republic · PUJ", kind: "area", airportCode: "PUJ", country: "Dominican Republic" },
  { value: "Uvero Alto, Punta Cana, Dominican Republic", label: "Uvero Alto", detail: "Punta Cana resort area · Dominican Republic · PUJ", kind: "area", airportCode: "PUJ", country: "Dominican Republic" },
  { value: "Bayahibe, La Altagracia, Dominican Republic", label: "Bayahibe", detail: "Coastal town · La Romana area · Dominican Republic · LRM", kind: "area", airportCode: "LRM", country: "Dominican Republic" },
  { value: "Sosúa, Puerto Plata, Dominican Republic", label: "Sosúa", detail: "Beach town · Puerto Plata area · Dominican Republic · POP", kind: "area", airportCode: "POP", country: "Dominican Republic" },
  { value: "Cabarete, Puerto Plata, Dominican Republic", label: "Cabarete", detail: "Beach and watersports town · Dominican Republic · POP", kind: "area", airportCode: "POP", country: "Dominican Republic" },
  { value: "Las Terrenas, Samaná, Dominican Republic", label: "Las Terrenas", detail: "Coastal town · Samaná · Dominican Republic · AZS", kind: "area", airportCode: "AZS", country: "Dominican Republic" },
  { value: "Samaná, Dominican Republic", label: "Samaná", detail: "Coastal region · Dominican Republic · AZS", kind: "city", airportCode: "AZS", country: "Dominican Republic" },
  { value: "Jarabacoa, La Vega, Dominican Republic", label: "Jarabacoa", detail: "Mountain town · Dominican Republic · STI", kind: "area", airportCode: "STI", country: "Dominican Republic" },
  { value: "Constanza, La Vega, Dominican Republic", label: "Constanza", detail: "Mountain town · Dominican Republic · STI", kind: "area", airportCode: "STI", country: "Dominican Republic" },
  { value: "San Juan, Puerto Rico", label: "San Juan", detail: "Puerto Rico · Luis Muñoz Marín International Airport", kind: "city", airportCode: "SJU", country: "Puerto Rico" },
  { value: "Montego Bay, Jamaica", label: "Montego Bay", detail: "Jamaica · Sangster International Airport", kind: "city", airportCode: "MBJ", country: "Jamaica" },
  { value: "Orlando, United States", label: "Orlando", detail: "United States · Orlando International Airport", kind: "city", airportCode: "MCO", country: "United States" },
  { value: "New Orleans, United States", label: "New Orleans", detail: "United States · Louis Armstrong International Airport", kind: "city", airportCode: "MSY", country: "United States" },
  { value: "Barcelona, Spain", label: "Barcelona", detail: "Spain · Barcelona–El Prat Airport", kind: "city", airportCode: "BCN", country: "Spain" },
  { value: "Paris, France", label: "Paris", detail: "France · Charles de Gaulle / Orly airports", kind: "city", airportCode: "PAR", country: "France" },
  { value: "Rome, Italy", label: "Rome", detail: "Italy · Fiumicino / Ciampino airports", kind: "city", airportCode: "ROM", country: "Italy" },
  { value: "London, United Kingdom", label: "London", detail: "United Kingdom · Multiple airports", kind: "city", airportCode: "LON", country: "United Kingdom" },
  { value: "Tokyo, Japan", label: "Tokyo", detail: "Japan · Haneda / Narita airports", kind: "city", airportCode: "TYO", country: "Japan" },
  { value: "Reykjavík, Iceland", label: "Reykjavík", detail: "Iceland · Keflavík International Airport", kind: "city", airportCode: "KEF", country: "Iceland" },
  { value: "Aruba", label: "Aruba", detail: "Queen Beatrix International Airport", kind: "city", airportCode: "AUA", country: "Aruba" },
  { value: "Vancouver, Canada", label: "Vancouver", detail: "Canada · Vancouver International Airport", kind: "city", airportCode: "YVR", country: "Canada" },
  { value: "Montréal, Canada", label: "Montréal", detail: "Canada · Montréal–Trudeau Airport", kind: "city", airportCode: "YUL", country: "Canada" },
  { value: "Boston, United States", label: "Boston", detail: "United States · Logan International Airport", kind: "city", airportCode: "BOS", country: "United States" },
  { value: "Philadelphia, United States", label: "Philadelphia", detail: "United States · Philadelphia International Airport", kind: "city", airportCode: "PHL", country: "United States" },
  { value: "Miami, United States", label: "Miami", detail: "United States · Miami International Airport", kind: "city", airportCode: "MIA", country: "United States" },
  { value: "Los Angeles, United States", label: "Los Angeles", detail: "United States · Los Angeles International Airport", kind: "city", airportCode: "LAX", country: "United States" },
  { value: "Chicago, United States", label: "Chicago", detail: "United States · O’Hare / Midway airports", kind: "city", airportCode: "CHI", country: "United States" },
  { value: "San Francisco, United States", label: "San Francisco", detail: "United States · San Francisco International Airport", kind: "city", airportCode: "SFO", country: "United States" },
  { value: "Atlanta, United States", label: "Atlanta", detail: "United States · Hartsfield–Jackson Airport", kind: "city", airportCode: "ATL", country: "United States" },
  { value: "Washington, United States", label: "Washington", detail: "United States · DCA / IAD / BWI", kind: "city", airportCode: "WAS", country: "United States" },
];

// City and regional choices for narrowing a broad U.S. state search. The
// selected value always retains the state, so providers can resolve the exact
// locality and avoid falling back to a state-wide search.
const US_CITY_AREAS: LocationSuggestion[] = [
  { value: "Birmingham, Alabama", label: "Birmingham", detail: "Alabama · city", kind: "city", airportCode: "BHM", country: "Alabama" },
  { value: "Gulf Shores, Alabama", label: "Gulf Shores", detail: "Alabama · beach town", kind: "area", airportCode: "MOB", country: "Alabama" },
  { value: "Anchorage, Alaska", label: "Anchorage", detail: "Alaska · city", kind: "city", airportCode: "ANC", country: "Alaska" },
  { value: "Juneau, Alaska", label: "Juneau", detail: "Alaska · city", kind: "city", airportCode: "JNU", country: "Alaska" },
  { value: "Phoenix, Arizona", label: "Phoenix", detail: "Arizona · city", kind: "city", airportCode: "PHX", country: "Arizona" },
  { value: "Sedona, Arizona", label: "Sedona", detail: "Arizona · red-rock destination", kind: "area", airportCode: "PHX", country: "Arizona" },
  { value: "Grand Canyon, Arizona", label: "Grand Canyon", detail: "Arizona · national park region", kind: "area", airportCode: "PHX", country: "Arizona" },
  { value: "Little Rock, Arkansas", label: "Little Rock", detail: "Arkansas · city", kind: "city", airportCode: "LIT", country: "Arkansas" },
  { value: "Hot Springs, Arkansas", label: "Hot Springs", detail: "Arkansas · resort town", kind: "area", airportCode: "LIT", country: "Arkansas" },
  { value: "Los Angeles, California", label: "Los Angeles", detail: "California · city", kind: "city", airportCode: "LAX", country: "California" },
  { value: "San Diego, California", label: "San Diego", detail: "California · coastal city", kind: "city", airportCode: "SAN", country: "California" },
  { value: "San Francisco, California", label: "San Francisco", detail: "California · city", kind: "city", airportCode: "SFO", country: "California" },
  { value: "Sacramento, California", label: "Sacramento", detail: "California · city", kind: "city", airportCode: "SMF", country: "California" },
  { value: "Palm Springs, California", label: "Palm Springs", detail: "California · desert resort area", kind: "area", airportCode: "PSP", country: "California" },
  { value: "Denver, Colorado", label: "Denver", detail: "Colorado · city", kind: "city", airportCode: "DEN", country: "Colorado" },
  { value: "Colorado Springs, Colorado", label: "Colorado Springs", detail: "Colorado · city", kind: "city", airportCode: "COS", country: "Colorado" },
  { value: "Aspen, Colorado", label: "Aspen", detail: "Colorado · mountain resort town", kind: "area", airportCode: "ASE", country: "Colorado" },
  { value: "Hartford, Connecticut", label: "Hartford", detail: "Connecticut · city", kind: "city", airportCode: "BDL", country: "Connecticut" },
  { value: "Mystic, Connecticut", label: "Mystic", detail: "Connecticut · coastal village", kind: "area", airportCode: "BDL", country: "Connecticut" },
  { value: "Wilmington, Delaware", label: "Wilmington", detail: "Delaware · city", kind: "city", airportCode: "ILG", country: "Delaware" },
  { value: "Rehoboth Beach, Delaware", label: "Rehoboth Beach", detail: "Delaware · beach town", kind: "area", airportCode: "ILG", country: "Delaware" },
  { value: "Miami, Florida", label: "Miami", detail: "Florida · city", kind: "city", airportCode: "MIA", country: "Florida" },
  { value: "Orlando, Florida", label: "Orlando", detail: "Florida · city", kind: "city", airportCode: "MCO", country: "Florida" },
  { value: "Tampa, Florida", label: "Tampa", detail: "Florida · city", kind: "city", airportCode: "TPA", country: "Florida" },
  { value: "Key West, Florida", label: "Key West", detail: "Florida · island city", kind: "area", airportCode: "EYW", country: "Florida" },
  { value: "Atlanta, Georgia", label: "Atlanta", detail: "Georgia · city", kind: "city", airportCode: "ATL", country: "Georgia" },
  { value: "Savannah, Georgia", label: "Savannah", detail: "Georgia · historic coastal city", kind: "city", airportCode: "SAV", country: "Georgia" },
  { value: "Honolulu, Hawaii", label: "Honolulu", detail: "Hawaii · Oahu", kind: "city", airportCode: "HNL", country: "Hawaii" },
  { value: "Kailua-Kona, Hawaii", label: "Kailua-Kona", detail: "Hawaii · Big Island", kind: "area", airportCode: "KOA", country: "Hawaii" },
  { value: "Boise, Idaho", label: "Boise", detail: "Idaho · city", kind: "city", airportCode: "BOI", country: "Idaho" },
  { value: "Coeur d'Alene, Idaho", label: "Coeur d'Alene", detail: "Idaho · lake destination", kind: "area", airportCode: "BOI", country: "Idaho" },
  { value: "Chicago, Illinois", label: "Chicago", detail: "Illinois · city", kind: "city", airportCode: "CHI", country: "Illinois" },
  { value: "Springfield, Illinois", label: "Springfield", detail: "Illinois · city", kind: "city", airportCode: "SPI", country: "Illinois" },
  { value: "Indianapolis, Indiana", label: "Indianapolis", detail: "Indiana · city", kind: "city", airportCode: "IND", country: "Indiana" },
  { value: "Bloomington, Indiana", label: "Bloomington", detail: "Indiana · city", kind: "city", airportCode: "IND", country: "Indiana" },
  { value: "Des Moines, Iowa", label: "Des Moines", detail: "Iowa · city", kind: "city", airportCode: "DSM", country: "Iowa" },
  { value: "Iowa City, Iowa", label: "Iowa City", detail: "Iowa · city", kind: "city", airportCode: "DSM", country: "Iowa" },
  { value: "Wichita, Kansas", label: "Wichita", detail: "Kansas · city", kind: "city", airportCode: "ICT", country: "Kansas" },
  { value: "Overland Park, Kansas", label: "Overland Park", detail: "Kansas · city", kind: "city", airportCode: "MCI", country: "Kansas" },
  { value: "Louisville, Kentucky", label: "Louisville", detail: "Kentucky · city", kind: "city", airportCode: "SDF", country: "Kentucky" },
  { value: "Lexington, Kentucky", label: "Lexington", detail: "Kentucky · city", kind: "city", airportCode: "LEX", country: "Kentucky" },
  { value: "New Orleans, Louisiana", label: "New Orleans", detail: "Louisiana · city", kind: "city", airportCode: "MSY", country: "Louisiana" },
  { value: "Baton Rouge, Louisiana", label: "Baton Rouge", detail: "Louisiana · city", kind: "city", airportCode: "BTR", country: "Louisiana" },
  { value: "Portland, Maine", label: "Portland", detail: "Maine · city", kind: "city", airportCode: "PWM", country: "Maine" },
  { value: "Bar Harbor, Maine", label: "Bar Harbor", detail: "Maine · Acadia region", kind: "area", airportCode: "BGR", country: "Maine" },
  { value: "Baltimore, Maryland", label: "Baltimore", detail: "Maryland · city", kind: "city", airportCode: "BWI", country: "Maryland" },
  { value: "Ocean City, Maryland", label: "Ocean City", detail: "Maryland · beach town", kind: "area", airportCode: "BWI", country: "Maryland" },
  { value: "Boston, Massachusetts", label: "Boston", detail: "Massachusetts · city", kind: "city", airportCode: "BOS", country: "Massachusetts" },
  { value: "Cape Cod, Massachusetts", label: "Cape Cod", detail: "Massachusetts · coastal region", kind: "area", airportCode: "BOS", country: "Massachusetts" },
  { value: "Detroit, Michigan", label: "Detroit", detail: "Michigan · city", kind: "city", airportCode: "DTW", country: "Michigan" },
  { value: "Traverse City, Michigan", label: "Traverse City", detail: "Michigan · lake destination", kind: "city", airportCode: "TVC", country: "Michigan" },
  { value: "Minneapolis, Minnesota", label: "Minneapolis", detail: "Minnesota · city", kind: "city", airportCode: "MSP", country: "Minnesota" },
  { value: "Duluth, Minnesota", label: "Duluth", detail: "Minnesota · Lake Superior city", kind: "city", airportCode: "DLH", country: "Minnesota" },
  { value: "Biloxi, Mississippi", label: "Biloxi", detail: "Mississippi · Gulf Coast", kind: "area", airportCode: "GPT", country: "Mississippi" },
  { value: "Jackson, Mississippi", label: "Jackson", detail: "Mississippi · city", kind: "city", airportCode: "JAN", country: "Mississippi" },
  { value: "St. Louis, Missouri", label: "St. Louis", detail: "Missouri · city", kind: "city", airportCode: "STL", country: "Missouri" },
  { value: "Branson, Missouri", label: "Branson", detail: "Missouri · resort town", kind: "area", airportCode: "SGF", country: "Missouri" },
  { value: "Bozeman, Montana", label: "Bozeman", detail: "Montana · city", kind: "city", airportCode: "BZN", country: "Montana" },
  { value: "Missoula, Montana", label: "Missoula", detail: "Montana · city", kind: "city", airportCode: "MSO", country: "Montana" },
  { value: "Omaha, Nebraska", label: "Omaha", detail: "Nebraska · city", kind: "city", airportCode: "OMA", country: "Nebraska" },
  { value: "Lincoln, Nebraska", label: "Lincoln", detail: "Nebraska · city", kind: "city", airportCode: "LNK", country: "Nebraska" },
  { value: "Las Vegas, Nevada", label: "Las Vegas", detail: "Nevada · city", kind: "city", airportCode: "LAS", country: "Nevada" },
  { value: "Reno, Nevada", label: "Reno", detail: "Nevada · city", kind: "city", airportCode: "RNO", country: "Nevada" },
  { value: "Manchester, New Hampshire", label: "Manchester", detail: "New Hampshire · city", kind: "city", airportCode: "MHT", country: "New Hampshire" },
  { value: "White Mountains, New Hampshire", label: "White Mountains", detail: "New Hampshire · mountain region", kind: "area", airportCode: "MHT", country: "New Hampshire" },
  { value: "Jersey City, New Jersey", label: "Jersey City", detail: "New Jersey · city", kind: "city", airportCode: "EWR", country: "New Jersey" },
  { value: "Atlantic City, New Jersey", label: "Atlantic City", detail: "New Jersey · coastal resort city", kind: "city", airportCode: "ACY", country: "New Jersey" },
  { value: "Cape May, New Jersey", label: "Cape May", detail: "New Jersey · shore town", kind: "area", airportCode: "ACY", country: "New Jersey" },
  { value: "Albuquerque, New Mexico", label: "Albuquerque", detail: "New Mexico · city", kind: "city", airportCode: "ABQ", country: "New Mexico" },
  { value: "Santa Fe, New Mexico", label: "Santa Fe", detail: "New Mexico · historic city", kind: "city", airportCode: "ABQ", country: "New Mexico" },
  { value: "New York City, New York", label: "New York City", detail: "New York · city", kind: "city", airportCode: "NYC", country: "New York" },
  { value: "Buffalo, New York", label: "Buffalo", detail: "New York · city", kind: "city", airportCode: "BUF", country: "New York" },
  { value: "Adirondacks, New York", label: "Adirondacks", detail: "New York · mountain region", kind: "area", airportCode: "ALB", country: "New York" },
  { value: "Charlotte, North Carolina", label: "Charlotte", detail: "North Carolina · city", kind: "city", airportCode: "CLT", country: "North Carolina" },
  { value: "Asheville, North Carolina", label: "Asheville", detail: "North Carolina · mountain city", kind: "city", airportCode: "AVL", country: "North Carolina" },
  { value: "Outer Banks, North Carolina", label: "Outer Banks", detail: "North Carolina · coastal region", kind: "area", airportCode: "ORF", country: "North Carolina" },
  { value: "Fargo, North Dakota", label: "Fargo", detail: "North Dakota · city", kind: "city", airportCode: "FAR", country: "North Dakota" },
  { value: "Cleveland, Ohio", label: "Cleveland", detail: "Ohio · city", kind: "city", airportCode: "CLE", country: "Ohio" },
  { value: "Columbus, Ohio", label: "Columbus", detail: "Ohio · city", kind: "city", airportCode: "CMH", country: "Ohio" },
  { value: "Oklahoma City, Oklahoma", label: "Oklahoma City", detail: "Oklahoma · city", kind: "city", airportCode: "OKC", country: "Oklahoma" },
  { value: "Tulsa, Oklahoma", label: "Tulsa", detail: "Oklahoma · city", kind: "city", airportCode: "TUL", country: "Oklahoma" },
  { value: "Portland, Oregon", label: "Portland", detail: "Oregon · city", kind: "city", airportCode: "PDX", country: "Oregon" },
  { value: "Bend, Oregon", label: "Bend", detail: "Oregon · outdoor destination", kind: "city", airportCode: "RDM", country: "Oregon" },
  { value: "Pocono Mountains, Pennsylvania", label: "Pocono Mountains", detail: "Pennsylvania · regional destination · nearby towns included", kind: "area", airportCode: "AVP", country: "Pennsylvania" },
  { value: "Poconos, Pennsylvania", label: "Poconos", detail: "Pennsylvania · regional destination · nearby towns included", kind: "area", airportCode: "AVP", country: "Pennsylvania" },
  { value: "Mount Pocono, Pennsylvania", label: "Mount Pocono", detail: "Pennsylvania · Pocono Mountains town", kind: "city", airportCode: "AVP", country: "Pennsylvania" },
  { value: "Stroudsburg, Pennsylvania", label: "Stroudsburg", detail: "Pennsylvania · Pocono Mountains town", kind: "city", airportCode: "AVP", country: "Pennsylvania" },
  { value: "East Stroudsburg, Pennsylvania", label: "East Stroudsburg", detail: "Pennsylvania · Pocono Mountains town", kind: "city", airportCode: "AVP", country: "Pennsylvania" },
  { value: "Jim Thorpe, Pennsylvania", label: "Jim Thorpe", detail: "Pennsylvania · Pocono Mountains area", kind: "area", airportCode: "AVP", country: "Pennsylvania" },
  { value: "Lake Harmony, Pennsylvania", label: "Lake Harmony", detail: "Pennsylvania · Pocono Mountains area", kind: "area", airportCode: "AVP", country: "Pennsylvania" },
  { value: "Scranton, Pennsylvania", label: "Scranton", detail: "Pennsylvania · city", kind: "city", airportCode: "AVP", country: "Pennsylvania" },
  { value: "Philadelphia, Pennsylvania", label: "Philadelphia", detail: "Pennsylvania · city", kind: "city", airportCode: "PHL", country: "Pennsylvania" },
  { value: "Pittsburgh, Pennsylvania", label: "Pittsburgh", detail: "Pennsylvania · city", kind: "city", airportCode: "PIT", country: "Pennsylvania" },
  { value: "Lancaster, Pennsylvania", label: "Lancaster", detail: "Pennsylvania · city", kind: "city", airportCode: "PHL", country: "Pennsylvania" },
  { value: "Providence, Rhode Island", label: "Providence", detail: "Rhode Island · city", kind: "city", airportCode: "PVD", country: "Rhode Island" },
  { value: "Newport, Rhode Island", label: "Newport", detail: "Rhode Island · coastal town", kind: "area", airportCode: "PVD", country: "Rhode Island" },
  { value: "Charleston, South Carolina", label: "Charleston", detail: "South Carolina · city", kind: "city", airportCode: "CHS", country: "South Carolina" },
  { value: "Myrtle Beach, South Carolina", label: "Myrtle Beach", detail: "South Carolina · beach city", kind: "area", airportCode: "MYR", country: "South Carolina" },
  { value: "Sioux Falls, South Dakota", label: "Sioux Falls", detail: "South Dakota · city", kind: "city", airportCode: "FSD", country: "South Dakota" },
  { value: "Black Hills, South Dakota", label: "Black Hills", detail: "South Dakota · mountain region", kind: "area", airportCode: "RAP", country: "South Dakota" },
  { value: "Nashville, Tennessee", label: "Nashville", detail: "Tennessee · city", kind: "city", airportCode: "BNA", country: "Tennessee" },
  { value: "Gatlinburg, Tennessee", label: "Gatlinburg", detail: "Tennessee · Smoky Mountains gateway", kind: "area", airportCode: "TYS", country: "Tennessee" },
  { value: "Austin, Texas", label: "Austin", detail: "Texas · city", kind: "city", airportCode: "AUS", country: "Texas" },
  { value: "Dallas, Texas", label: "Dallas", detail: "Texas · city", kind: "city", airportCode: "DFW", country: "Texas" },
  { value: "Houston, Texas", label: "Houston", detail: "Texas · city", kind: "city", airportCode: "IAH", country: "Texas" },
  { value: "Salt Lake City, Utah", label: "Salt Lake City", detail: "Utah · city", kind: "city", airportCode: "SLC", country: "Utah" },
  { value: "Moab, Utah", label: "Moab", detail: "Utah · national park gateway", kind: "area", airportCode: "SLC", country: "Utah" },
  { value: "Burlington, Vermont", label: "Burlington", detail: "Vermont · city", kind: "city", airportCode: "BTV", country: "Vermont" },
  { value: "Stowe, Vermont", label: "Stowe", detail: "Vermont · mountain town", kind: "area", airportCode: "BTV", country: "Vermont" },
  { value: "Virginia Beach, Virginia", label: "Virginia Beach", detail: "Virginia · coastal city", kind: "city", airportCode: "ORF", country: "Virginia" },
  { value: "Richmond, Virginia", label: "Richmond", detail: "Virginia · city", kind: "city", airportCode: "RIC", country: "Virginia" },
  { value: "Seattle, Washington", label: "Seattle", detail: "Washington · city", kind: "city", airportCode: "SEA", country: "Washington" },
  { value: "Spokane, Washington", label: "Spokane", detail: "Washington · city", kind: "city", airportCode: "GEG", country: "Washington" },
  { value: "Charleston, West Virginia", label: "Charleston", detail: "West Virginia · city", kind: "city", airportCode: "CRW", country: "West Virginia" },
  { value: "New River Gorge, West Virginia", label: "New River Gorge", detail: "West Virginia · outdoor region", kind: "area", airportCode: "CRW", country: "West Virginia" },
  { value: "Milwaukee, Wisconsin", label: "Milwaukee", detail: "Wisconsin · city", kind: "city", airportCode: "MKE", country: "Wisconsin" },
  { value: "Wisconsin Dells, Wisconsin", label: "Wisconsin Dells", detail: "Wisconsin · resort area", kind: "area", airportCode: "MSN", country: "Wisconsin" },
  { value: "Jackson Hole, Wyoming", label: "Jackson Hole", detail: "Wyoming · mountain resort region", kind: "area", airportCode: "JAC", country: "Wyoming" },
  { value: "Yellowstone, Wyoming", label: "Yellowstone", detail: "Wyoming · national park region", kind: "area", airportCode: "JAC", country: "Wyoming" },
  { value: "Washington, District of Columbia", label: "Washington, DC", detail: "District of Columbia · city", kind: "city", airportCode: "WAS", country: "District of Columbia" },
];

const DESTINATION_REGIONS: LocationSuggestion[] = [
  { value: "Dominican Republic", label: "Dominican Republic", detail: "Country · choose a gateway airport if searching flights", kind: "region", airportCode: "", country: "Dominican Republic" },
  { value: "Mexico", label: "Mexico", detail: "Country · choose a city for flights, or search stays and places country-wide", kind: "region", airportCode: "", country: "Mexico" },
  { value: "Portugal", label: "Portugal", detail: "Country · choose a gateway airport if searching flights", kind: "region", airportCode: "", country: "Portugal" },
  { value: "Puerto Rico", label: "Puerto Rico", detail: "Island territory · San Juan is the main flight gateway", kind: "region", airportCode: "", country: "Puerto Rico" },
  { value: "Jamaica", label: "Jamaica", detail: "Country · choose an arrival airport for flights", kind: "region", airportCode: "", country: "Jamaica" },
  { value: "United States", label: "United States", detail: "Country · choose a city or airport for flights", kind: "region", airportCode: "", country: "United States" },
  { value: "Canada", label: "Canada", detail: "Country · choose a city or airport for flights", kind: "region", airportCode: "", country: "Canada" },
  { value: "France", label: "France", detail: "Country · choose a city or airport for flights", kind: "region", airportCode: "", country: "France" },
  { value: "Italy", label: "Italy", detail: "Country · choose a city or airport for flights", kind: "region", airportCode: "", country: "Italy" },
  { value: "Spain", label: "Spain", detail: "Country · choose a city or airport for flights", kind: "region", airportCode: "", country: "Spain" },
  { value: "Japan", label: "Japan", detail: "Country · choose a city or airport for flights", kind: "region", airportCode: "", country: "Japan" },
];

DESTINATION_REGIONS.push(
  ...US_STATES.map((state) => ({
    value: state.name, label: state.name,
    detail: `US state · ${state.abbreviation} · ${state.airports.map((airport) => airport.code).join(", ")}`,
    kind: "region" as const, airportCode: "", country: "United States",
  })),
  ...COUNTRY_NAMES.filter((name) => !DESTINATION_REGIONS.some((item) => norm(item.value) === norm(name))).map((name) => ({
    value: name, label: name, detail: "Country · choose a city or enter an airport code for flights",
    kind: "region" as const, airportCode: "", country: name,
  })),
);

const DESTINATION_ATTRACTIONS: LocationSuggestion[] = [
  { value: "Bávaro Beach, Punta Cana, Dominican Republic", label: "Bávaro Beach", detail: "Beach · Punta Cana · Punta Cana Airport (PUJ)", kind: "attraction", airportCode: "PUJ", country: "Dominican Republic" },
  { value: "Saona Island, Dominican Republic", label: "Saona Island", detail: "Island excursion · Dominican Republic · Punta Cana (PUJ)", kind: "attraction", airportCode: "PUJ", country: "Dominican Republic" },
  { value: "Altos de Chavón, La Romana, Dominican Republic", label: "Altos de Chavón", detail: "Historic village · La Romana · LRM", kind: "attraction", airportCode: "LRM", country: "Dominican Republic" },
  { value: "Colonial Zone, Santo Domingo, Dominican Republic", label: "Colonial Zone", detail: "Historic district · Santo Domingo · SDQ", kind: "attraction", airportCode: "SDQ", country: "Dominican Republic" },
  { value: "27 Waterfalls of Damajagua, Puerto Plata, Dominican Republic", label: "27 Waterfalls of Damajagua", detail: "Outdoor attraction · Puerto Plata · POP", kind: "attraction", airportCode: "POP", country: "Dominican Republic" },
  { value: "Isla Mujeres, Quintana Roo, Mexico", label: "Isla Mujeres", detail: "Island · Cancún area · CUN", kind: "attraction", airportCode: "CUN", country: "Mexico" },
  { value: "Tulum Archaeological Zone, Mexico", label: "Tulum Ruins", detail: "Archaeological site · Riviera Maya · CUN", kind: "attraction", airportCode: "CUN", country: "Mexico" },
  { value: "Chichén Itzá, Yucatán, Mexico", label: "Chichén Itzá", detail: "Archaeological site · Yucatán · CUN", kind: "attraction", airportCode: "CUN", country: "Mexico" },
  { value: "Playa del Carmen, Quintana Roo, Mexico", label: "Playa del Carmen", detail: "Beach town · Riviera Maya · CUN", kind: "attraction", airportCode: "CUN", country: "Mexico" },
  { value: "Dunn's River Falls, Ocho Rios, Jamaica", label: "Dunn’s River Falls", detail: "Waterfall attraction · Ocho Rios · MBJ", kind: "attraction", airportCode: "MBJ", country: "Jamaica" },
  { value: "Seven Mile Beach, Negril, Jamaica", label: "Seven Mile Beach", detail: "Beach · Negril · MBJ", kind: "attraction", airportCode: "MBJ", country: "Jamaica" },
  { value: "Old San Juan, Puerto Rico", label: "Old San Juan", detail: "Historic district · San Juan · SJU", kind: "attraction", airportCode: "SJU", country: "Puerto Rico" },
  { value: "El Yunque National Forest, Puerto Rico", label: "El Yunque National Forest", detail: "National forest · Puerto Rico · SJU", kind: "attraction", airportCode: "SJU", country: "Puerto Rico" },
  { value: "Sintra, Portugal", label: "Sintra", detail: "Historic town and palaces · Lisbon area · LIS", kind: "attraction", airportCode: "LIS", country: "Portugal" },
  { value: "Belém, Lisbon, Portugal", label: "Belém", detail: "Historic waterfront · Lisbon · LIS", kind: "attraction", airportCode: "LIS", country: "Portugal" },
  { value: "Sagrada Família, Barcelona, Spain", label: "Sagrada Família", detail: "Landmark · Barcelona · BCN", kind: "attraction", airportCode: "BCN", country: "Spain" },
];

export type DestinationAreaGeo = {
  latitude: number;
  longitude: number;
  activityRadiusMiles: number;
  restaurantRadiusMiles: number;
  hotelRadiusMiles: number;
  addressAliases: string[];
};

const DESTINATION_AREA_GEOS: Array<{ aliases: string[]; geo: DestinationAreaGeo }> = [
  {
    aliases: ["pocono mountains", "poconos", "pocono region", "pocono", "stroudsburg", "east stroudsburg", "mount pocono", "tannersville", "jim thorpe", "lake harmony", "hawley", "milford", "tobyhanna", "long pond", "blakeslee", "swiftwater", "bushkill", "scranton"],
    geo: {
      latitude: 41.05,
      longitude: -75.25,
      activityRadiusMiles: 55,
      restaurantRadiusMiles: 40,
      hotelRadiusMiles: 50,
      addressAliases: ["stroudsburg", "east stroudsburg", "mount pocono", "tannersville", "jim thorpe", "lake harmony", "hawley", "milford", "tobyhanna", "long pond", "blakeslee", "swiftwater", "bushkill", "scranton"],
    },
  },
  {
    aliases: ["punta cana", "bavaro", "bávaro", "cap cana", "uvero alto", "cabeza de toro", "macao", "friusa", "veron"],
    geo: { latitude: 18.5601, longitude: -68.3725, activityRadiusMiles: 42, restaurantRadiusMiles: 28, hotelRadiusMiles: 38, addressAliases: ["punta cana", "bavaro", "bávaro", "cap cana", "uvero alto", "cabeza de toro", "macao", "friusa", "veron"] },
  },
  {
    aliases: ["santo domingo", "zona colonial", "colonial zone", "piantini", "naco", "bella vista", "gazcue", "malecon"],
    geo: { latitude: 18.4861, longitude: -69.9312, activityRadiusMiles: 34, restaurantRadiusMiles: 22, hotelRadiusMiles: 30, addressAliases: ["santo domingo", "zona colonial", "colonial zone", "piantini", "naco", "bella vista", "gazcue", "malecon"] },
  },
  {
    aliases: ["puerto plata", "sosua", "sosúa", "cabarete", "playa dorada", "cofresi", "cofrési"],
    geo: { latitude: 19.7934, longitude: -70.6884, activityRadiusMiles: 42, restaurantRadiusMiles: 28, hotelRadiusMiles: 38, addressAliases: ["puerto plata", "sosua", "sosúa", "cabarete", "playa dorada", "cofresi", "cofrési"] },
  },
  {
    aliases: ["santiago", "santiago de los caballeros", "jarabacoa", "constanza", "la vega"],
    geo: { latitude: 19.4517, longitude: -70.6970, activityRadiusMiles: 38, restaurantRadiusMiles: 22, hotelRadiusMiles: 32, addressAliases: ["santiago", "santiago de los caballeros", "jarabacoa", "constanza", "la vega"] },
  },
  {
    aliases: ["la romana", "bayahibe", "dominicus", "casa de campo"],
    geo: { latitude: 18.4273, longitude: -68.9728, activityRadiusMiles: 38, restaurantRadiusMiles: 24, hotelRadiusMiles: 34, addressAliases: ["la romana", "bayahibe", "dominicus", "casa de campo"] },
  },
  {
    aliases: ["samana", "samaná", "las terrenas", "las galeras", "el limon"],
    geo: { latitude: 19.2050, longitude: -69.3360, activityRadiusMiles: 42, restaurantRadiusMiles: 25, hotelRadiusMiles: 36, addressAliases: ["samana", "samaná", "las terrenas", "las galeras", "el limon"] },
  },
];

export function getDestinationAreaGeo(value: string): DestinationAreaGeo | undefined {
  const normalized = norm(value);
  return DESTINATION_AREA_GEOS.find(({ aliases }) => aliases.some((alias) => normalized.includes(norm(alias))))?.geo;
}

export type DestinationGateway = { code: string; label: string; city: string };

const REGION_GATEWAYS: Record<string, DestinationGateway[]> = {
  "dominican republic": [
    { code: "PUJ", city: "Punta Cana", label: "Punta Cana · PUJ" },
    { code: "SDQ", city: "Santo Domingo", label: "Santo Domingo · SDQ" },
    { code: "POP", city: "Puerto Plata", label: "Puerto Plata · POP" },
    { code: "STI", city: "Santiago", label: "Santiago · STI" },
    { code: "LRM", city: "La Romana", label: "La Romana · LRM" },
    { code: "AZS", city: "Samaná / Las Terrenas", label: "Samaná El Catey · AZS" },
  ],
  mexico: [
    { code: "CUN", city: "Cancún", label: "Cancún · CUN" },
    { code: "MEX", city: "Mexico City", label: "Mexico City · MEX" },
  ],
  portugal: [{ code: "LIS", city: "Lisbon", label: "Lisbon · LIS" }],
  "puerto rico": [{ code: "SJU", city: "San Juan", label: "San Juan · SJU" }],
  jamaica: [{ code: "MBJ", city: "Montego Bay", label: "Montego Bay · MBJ" }],
  spain: [{ code: "BCN", city: "Barcelona", label: "Barcelona · BCN" }],
  france: [{ code: "PAR", city: "Paris", label: "Paris · PAR" }],
  italy: [{ code: "ROM", city: "Rome", label: "Rome · ROM" }],
  japan: [{ code: "TYO", city: "Tokyo", label: "Tokyo · TYO" }],
  "united states": [
    { code: "MCO", city: "Orlando", label: "Orlando · MCO" },
    { code: "MSY", city: "New Orleans", label: "New Orleans · MSY" },
  ],
  canada: [
    { code: "YVR", city: "Vancouver", label: "Vancouver · YVR" },
    { code: "YUL", city: "Montréal", label: "Montréal · YUL" },
  ],
};

// A country-wide U.S. flight search should expose gateways across all states,
// not only the two airports that happened to be in the original curated list.
REGION_GATEWAYS["united states"] = US_STATES.flatMap((state) => state.airports.map((airport) => ({
  code: airport.code, city: airport.city, label: `${state.name} · ${airport.city} · ${airport.code}`,
})));
for (const state of US_STATES) {
  REGION_GATEWAYS[norm(state.name)] = state.airports.map((airport) => ({
    code: airport.code, city: airport.city, label: `${airport.city} · ${airport.code}`,
  }));
  REGION_GATEWAYS[norm(state.abbreviation)] = REGION_GATEWAYS[norm(state.name)];
}

const ORIGIN_AIRPORTS: LocationSuggestion[] = [
  { value: "New York (NYC)", label: "New York · All airports", detail: "New York metro · JFK, LaGuardia and Newark", kind: "city", airportCode: "NYC", country: "United States" },
  { value: "John F. Kennedy International Airport (JFK)", label: "John F. Kennedy International", detail: "Queens, New York · JFK", kind: "airport", airportCode: "JFK", country: "United States" },
  { value: "LaGuardia Airport (LGA)", label: "LaGuardia Airport", detail: "Queens, New York · LGA", kind: "airport", airportCode: "LGA", country: "United States" },
  { value: "Newark Liberty International Airport (EWR)", label: "Newark Liberty International", detail: "Newark, New Jersey · EWR", kind: "airport", airportCode: "EWR", country: "United States" },
  { value: "Boston Logan International (BOS)", label: "Boston Logan International", detail: "Boston, Massachusetts · BOS", kind: "airport", airportCode: "BOS", country: "United States" },
  { value: "Philadelphia International (PHL)", label: "Philadelphia International", detail: "Philadelphia, Pennsylvania · PHL", kind: "airport", airportCode: "PHL", country: "United States" },
  { value: "Baltimore/Washington International (BWI)", label: "Baltimore/Washington International", detail: "Baltimore, Maryland · BWI", kind: "airport", airportCode: "BWI", country: "United States" },
  { value: "Washington Dulles International (IAD)", label: "Washington Dulles International", detail: "Dulles, Virginia · IAD", kind: "airport", airportCode: "IAD", country: "United States" },
  { value: "Ronald Reagan Washington National (DCA)", label: "Ronald Reagan Washington National", detail: "Arlington, Virginia · DCA", kind: "airport", airportCode: "DCA", country: "United States" },
  { value: "Hartsfield–Jackson Atlanta (ATL)", label: "Hartsfield–Jackson Atlanta", detail: "Atlanta, Georgia · ATL", kind: "airport", airportCode: "ATL", country: "United States" },
  { value: "Miami International (MIA)", label: "Miami International", detail: "Miami, Florida · MIA", kind: "airport", airportCode: "MIA", country: "United States" },
  { value: "Orlando International (MCO)", label: "Orlando International", detail: "Orlando, Florida · MCO", kind: "airport", airportCode: "MCO", country: "United States" },
  { value: "Chicago O’Hare (ORD)", label: "Chicago O’Hare", detail: "Chicago, Illinois · ORD", kind: "airport", airportCode: "ORD", country: "United States" },
  { value: "Los Angeles International (LAX)", label: "Los Angeles International", detail: "Los Angeles, California · LAX", kind: "airport", airportCode: "LAX", country: "United States" },
  { value: "San Francisco International (SFO)", label: "San Francisco International", detail: "San Francisco, California · SFO", kind: "airport", airportCode: "SFO", country: "United States" },
];

function norm(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function getUSStateRegion(value: string): USState | undefined {
  const normalized = norm(value).replace(/ united states$/, "").trim();
  return US_STATES.find((state) => norm(state.name) === normalized || norm(state.abbreviation) === normalized);
}

export function getDestinationStateRegion(value: string): USState | undefined {
  return value.split(",").map((part) => getUSStateRegion(part.trim())).find((state): state is USState => Boolean(state));
}

/** Returns the selected top-level state/country so the search form can ask for a city or area within it. */
export function getDestinationRegionScope(value: string): string | undefined {
  const state = getUSStateRegion(value);
  if (state) return state.name;
  const region = DESTINATION_REGIONS.find((entry) => norm(entry.value) === norm(value) || norm(entry.label) === norm(value));
  if (!region) return undefined;
  // Some island destinations (for example Aruba) are also their own practical
  // base. Do not force users to select the same name again as a nested city.
  const sameNameBase = DESTINATION_LOCATIONS.find((item) =>
    norm(item.value) === norm(value) && norm(item.label) === norm(value) && Boolean(item.airportCode)
  );
  return sameNameBase ? undefined : region.value;
}

export function getUSStateAddressAliases(value: string): string[] {
  const state = getDestinationStateRegion(value);
  return state ? [norm(state.name), norm(state.abbreviation)] : [];
}

const AIRPORT_NAMES: Record<string, string> = {
  PUJ: "Punta Cana International Airport", SDQ: "Las Américas International Airport",
  POP: "Gregorio Luperón International Airport", STI: "Cibao International Airport",
  LRM: "La Romana International Airport", AZS: "Samaná El Catey International Airport", CUN: "Cancún International Airport",
  MEX: "Mexico City International Airport", LIS: "Humberto Delgado Airport",
  SJU: "Luis Muñoz Marín International Airport", MBJ: "Sangster International Airport",
  BCN: "Barcelona–El Prat Airport", PAR: "Paris Charles de Gaulle Airport",
  ROM: "Rome Fiumicino Airport", TYO: "Tokyo Haneda Airport", MCO: "Orlando International Airport",
  MSY: "Louis Armstrong New Orleans International Airport", YVR: "Vancouver International Airport",
  YUL: "Montréal–Trudeau International Airport",
};

export function getLocationSuggestions(
  query: string,
  field: "origin" | "destination",
  includeAttractions = false,
  includeAirports = false,
  regionScope = "",
): LocationSuggestion[] {
  const q = norm(query);
  if (field === "origin") {
    const stateAirports = US_STATES.flatMap((state) => state.airports.map((airport) => ({
      value: `${airport.city}, ${state.name} (${airport.code})`, label: `${airport.city} · ${airport.code}`,
      detail: `${state.name} (${state.abbreviation}), United States · departure airport`, kind: "airport" as const,
      airportCode: airport.code, country: "United States",
    })));
    const allOriginAirports = [...ORIGIN_AIRPORTS, ...stateAirports];
    const matches = q.length < 2
      ? ORIGIN_AIRPORTS.slice(0, 7)
      : allOriginAirports.filter((item) => [item.value, item.label, item.detail, item.airportCode].some((value) => norm(value).includes(q)));
    return matches.slice(0, 16);
  }

  const stateQuery = getUSStateRegion(query);
  const matchingRegions = DESTINATION_REGIONS.filter((item) =>
    (stateQuery && norm(item.label) === norm(stateQuery.name)) ||
    (q.length >= 2 && [item.value, item.label, item.detail].some((value) => norm(value).includes(q)))
  );
  const airportSuggestions: LocationSuggestion[] = includeAirports
    ? matchingRegions.flatMap((region) => getDestinationGateways(region.value).map((gateway) => ({
      // Keep the country-wide search area while storing the selected gateway
      // airport separately for flight lookup.
      value: region.value,
      label: AIRPORT_NAMES[gateway.code] ?? `${gateway.city} Airport`,
      detail: `${gateway.city} · ${gateway.code} · ${region.value}`,
      kind: "airport" as const,
      airportCode: gateway.code,
      country: region.value,
    })))
    : [];

  const allSource = [...DESTINATION_REGIONS, ...airportSuggestions, ...DESTINATION_LOCATIONS, ...US_CITY_AREAS, ...(includeAttractions ? DESTINATION_ATTRACTIONS : [])];
  const scope = norm(regionScope);
  const source = scope
    ? allSource.filter((item) => item.kind !== "region" && item.kind !== "airport" && (
      norm(item.country) === scope
      || item.value.split(",").some((part) => norm(part) === scope)
      || item.detail.split(/[·,]/).some((part) => norm(part) === scope)
    ))
    : allSource;
  if (q.length < 2) return source.slice(0, 20);
  const matching = source.filter((item) =>
    (stateQuery && item.kind === "region" && norm(item.label) === norm(stateQuery.name)) ||
    (stateQuery && item.kind !== "region" && norm(item.value).includes(norm(stateQuery.name))) ||
    [item.value, item.label, item.detail, item.airportCode].some((value) => norm(value).includes(q))
  );
  return matching.sort((a, b) => {
    const rank = (item: LocationSuggestion) => item.kind === "region" ? 0 : item.kind === "airport" ? 1 : item.kind === "city" ? 2 : item.kind === "area" ? 3 : 4;
    const aCountry = norm(a.value) === q || norm(a.label) === q ? 0 : 1;
    const bCountry = norm(b.value) === q || norm(b.label) === q ? 0 : 1;
    // Preserve the curated gateway and attraction order inside each group so
    // the most relevant local choices stay first instead of alphabetically.
    return aCountry - bCountry || rank(a) - rank(b);
  }).slice(0, 20);
}

export function destinationMetadata(value: string): { city: string; country: string; airportCode: string } {
  const q = norm(value);
  const state = getUSStateRegion(value);
  if (state) return { city: state.name, country: "United States", airportCode: "" };
  const metadataItems = [...DESTINATION_LOCATIONS, ...US_CITY_AREAS, ...DESTINATION_ATTRACTIONS];
  const item = metadataItems.find((entry) => norm(entry.value) === q || norm(entry.label) === q || norm(entry.airportCode) === q)
    // Accept the shorter natural-language form "Las Terrenas, Dominican Republic"
    // while keeping the canonical area record and its Samaná airport gateway.
    ?? metadataItems.find((entry) => {
      const parts = value.split(",").map((part) => norm(part.trim())).filter(Boolean);
      return parts.includes(norm(entry.label)) && parts.includes(norm(entry.country));
    });
  if (item) return { city: item.label, country: item.country, airportCode: item.airportCode };
  const region = DESTINATION_REGIONS.find((entry) => norm(entry.value) === q || norm(entry.label) === q);
  if (region) return { city: region.label, country: region.country || "", airportCode: "" };
  return { city: value.trim(), country: "", airportCode: "" };
}

export function countryForDestination(value: string): string | undefined {
  return destinationMetadata(value).country || undefined;
}

export const AIRPORT_COORDINATES: Record<string, { latitude: number; longitude: number; name: string }> = {
  CUN: { latitude: 21.0365, longitude: -86.8771, name: "Cancún International Airport" },
  PUJ: { latitude: 18.5674, longitude: -68.3634, name: "Punta Cana International Airport" },
  SDQ: { latitude: 18.4297, longitude: -69.6689, name: "Las Américas International Airport" },
  POP: { latitude: 19.7579, longitude: -70.5700, name: "Gregorio Luperón International Airport" },
  STI: { latitude: 19.4061, longitude: -70.6047, name: "Cibao International Airport" },
  LRM: { latitude: 18.4507, longitude: -68.9118, name: "La Romana International Airport" },
  AZS: { latitude: 19.2690, longitude: -69.7370, name: "Samaná El Catey International Airport" },
  SJU: { latitude: 18.4394, longitude: -66.0018, name: "Luis Muñoz Marín International Airport" },
  MBJ: { latitude: 18.5037, longitude: -77.9134, name: "Sangster International Airport" },
  LIS: { latitude: 38.7742, longitude: -9.1342, name: "Lisbon Airport" },
  MEX: { latitude: 19.4361, longitude: -99.0719, name: "Mexico City International Airport" },
  MCO: { latitude: 28.4312, longitude: -81.3081, name: "Orlando International Airport" },
  MSY: { latitude: 29.9934, longitude: -90.2580, name: "Louis Armstrong New Orleans International Airport" },
  BCN: { latitude: 41.2974, longitude: 2.0833, name: "Barcelona–El Prat Airport" },
  PAR: { latitude: 49.0097, longitude: 2.5479, name: "Paris Charles de Gaulle Airport" },
  ROM: { latitude: 41.8003, longitude: 12.2389, name: "Rome Fiumicino Airport" },
  LON: { latitude: 51.4700, longitude: -0.4543, name: "London Heathrow Airport" },
  TYO: { latitude: 35.5494, longitude: 139.7798, name: "Tokyo Haneda Airport" },
  KEF: { latitude: 63.9850, longitude: -22.6056, name: "Keflavík International Airport" },
  AUA: { latitude: 12.5014, longitude: -70.0152, name: "Queen Beatrix International Airport" },
  YVR: { latitude: 49.1967, longitude: -123.1815, name: "Vancouver International Airport" },
  YUL: { latitude: 45.4706, longitude: -73.7408, name: "Montréal–Trudeau International Airport" },
  AVP: { latitude: 41.3385, longitude: -75.7234, name: "Wilkes-Barre/Scranton International Airport" },
  ABE: { latitude: 40.6524, longitude: -75.4408, name: "Lehigh Valley International Airport" },
};
export function getDestinationGateways(value: string): DestinationGateway[] {
  const state = getUSStateRegion(value);
  return (state ? REGION_GATEWAYS[norm(state.name)] : REGION_GATEWAYS[norm(value)]) ?? [];
}

