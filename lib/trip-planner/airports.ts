export type AirportDirectoryEntry = {
  code: string;
  city: string;
  name: string;
  country: string;
  timeZone: string;
  metroCode?: string;
  aliases?: string[];
};

/**
 * Curated passenger-airport directory used by local autocomplete only.
 * It is intentionally not a flight-schedule feed: the provider remains the
 * authority for whether an airport is bookable on a requested route/date.
 */
const AIRPORT_ROWS: AirportDirectoryEntry[] = [
  // United States
  { code: "JFK", city: "New York", name: "John F. Kennedy International Airport", country: "United States", timeZone: "America/New_York", metroCode: "NYC", aliases: ["Kennedy Airport", "New York JFK"] },
  { code: "LGA", city: "New York", name: "LaGuardia Airport", country: "United States", timeZone: "America/New_York", metroCode: "NYC", aliases: ["New York LaGuardia"] },
  { code: "EWR", city: "Newark", name: "Newark Liberty International Airport", country: "United States", timeZone: "America/New_York", metroCode: "NYC", aliases: ["New York Newark", "Newark Airport"] },
  { code: "BOS", city: "Boston", name: "Boston Logan International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "PHL", city: "Philadelphia", name: "Philadelphia International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "BWI", city: "Baltimore", name: "Baltimore/Washington International Airport", country: "United States", timeZone: "America/New_York", metroCode: "WAS" },
  { code: "DCA", city: "Washington", name: "Ronald Reagan Washington National Airport", country: "United States", timeZone: "America/New_York", metroCode: "WAS", aliases: ["Washington National"] },
  { code: "IAD", city: "Washington", name: "Washington Dulles International Airport", country: "United States", timeZone: "America/New_York", metroCode: "WAS", aliases: ["Dulles Airport"] },
  { code: "ATL", city: "Atlanta", name: "Hartsfield-Jackson Atlanta International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "MIA", city: "Miami", name: "Miami International Airport", country: "United States", timeZone: "America/New_York", metroCode: "MIA" },
  { code: "FLL", city: "Fort Lauderdale", name: "Fort Lauderdale-Hollywood International Airport", country: "United States", timeZone: "America/New_York", metroCode: "MIA" },
  { code: "PBI", city: "West Palm Beach", name: "Palm Beach International Airport", country: "United States", timeZone: "America/New_York", metroCode: "MIA" },
  { code: "MCO", city: "Orlando", name: "Orlando International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "TPA", city: "Tampa", name: "Tampa International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "JAX", city: "Jacksonville", name: "Jacksonville International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "ORD", city: "Chicago", name: "Chicago O'Hare International Airport", country: "United States", timeZone: "America/Chicago", metroCode: "CHI" },
  { code: "MDW", city: "Chicago", name: "Chicago Midway International Airport", country: "United States", timeZone: "America/Chicago", metroCode: "CHI" },
  { code: "DFW", city: "Dallas-Fort Worth", name: "Dallas Fort Worth International Airport", country: "United States", timeZone: "America/Chicago", metroCode: "DFW" },
  { code: "DAL", city: "Dallas", name: "Dallas Love Field", country: "United States", timeZone: "America/Chicago", metroCode: "DFW" },
  { code: "IAH", city: "Houston", name: "George Bush Intercontinental Airport", country: "United States", timeZone: "America/Chicago", metroCode: "HOU" },
  { code: "HOU", city: "Houston", name: "William P. Hobby Airport", country: "United States", timeZone: "America/Chicago", metroCode: "HOU" },
  { code: "DEN", city: "Denver", name: "Denver International Airport", country: "United States", timeZone: "America/Denver" },
  { code: "PHX", city: "Phoenix", name: "Phoenix Sky Harbor International Airport", country: "United States", timeZone: "America/Phoenix" },
  { code: "LAS", city: "Las Vegas", name: "Harry Reid International Airport", country: "United States", timeZone: "America/Los_Angeles" },
  { code: "LAX", city: "Los Angeles", name: "Los Angeles International Airport", country: "United States", timeZone: "America/Los_Angeles", aliases: ["Los Angeles LAX"] },
  { code: "BUR", city: "Burbank", name: "Hollywood Burbank Airport", country: "United States", timeZone: "America/Los_Angeles" },
  { code: "SNA", city: "Santa Ana", name: "John Wayne Airport", country: "United States", timeZone: "America/Los_Angeles", aliases: ["Orange County Airport"] },
  { code: "ONT", city: "Ontario", name: "Ontario International Airport", country: "United States", timeZone: "America/Los_Angeles" },
  { code: "SFO", city: "San Francisco", name: "San Francisco International Airport", country: "United States", timeZone: "America/Los_Angeles" },
  { code: "OAK", city: "Oakland", name: "Oakland San Francisco Bay Airport", country: "United States", timeZone: "America/Los_Angeles" },
  { code: "SJC", city: "San Jose", name: "Norman Y. Mineta San Jose International Airport", country: "United States", timeZone: "America/Los_Angeles" },
  { code: "SEA", city: "Seattle", name: "Seattle-Tacoma International Airport", country: "United States", timeZone: "America/Los_Angeles" },
  { code: "PDX", city: "Portland", name: "Portland International Airport", country: "United States", timeZone: "America/Los_Angeles" },
  { code: "SAN", city: "San Diego", name: "San Diego International Airport", country: "United States", timeZone: "America/Los_Angeles" },
  { code: "SLC", city: "Salt Lake City", name: "Salt Lake City International Airport", country: "United States", timeZone: "America/Denver" },
  { code: "MSP", city: "Minneapolis", name: "Minneapolis-Saint Paul International Airport", country: "United States", timeZone: "America/Chicago" },
  { code: "DTW", city: "Detroit", name: "Detroit Metropolitan Wayne County Airport", country: "United States", timeZone: "America/Detroit" },
  { code: "CLT", city: "Charlotte", name: "Charlotte Douglas International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "RDU", city: "Raleigh-Durham", name: "Raleigh-Durham International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "BNA", city: "Nashville", name: "Nashville International Airport", country: "United States", timeZone: "America/Chicago" },
  { code: "AUS", city: "Austin", name: "Austin-Bergstrom International Airport", country: "United States", timeZone: "America/Chicago" },
  { code: "SAT", city: "San Antonio", name: "San Antonio International Airport", country: "United States", timeZone: "America/Chicago" },
  { code: "MSY", city: "New Orleans", name: "Louis Armstrong New Orleans International Airport", country: "United States", timeZone: "America/Chicago" },
  { code: "PIT", city: "Pittsburgh", name: "Pittsburgh International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "BUF", city: "Buffalo", name: "Buffalo Niagara International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "CLE", city: "Cleveland", name: "Cleveland Hopkins International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "CMH", city: "Columbus", name: "John Glenn Columbus International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "IND", city: "Indianapolis", name: "Indianapolis International Airport", country: "United States", timeZone: "America/Indiana/Indianapolis" },
  { code: "STL", city: "St. Louis", name: "St. Louis Lambert International Airport", country: "United States", timeZone: "America/Chicago" },
  { code: "MKE", city: "Milwaukee", name: "Milwaukee Mitchell International Airport", country: "United States", timeZone: "America/Chicago" },
  { code: "SDF", city: "Louisville", name: "Louisville Muhammad Ali International Airport", country: "United States", timeZone: "America/Kentucky/Louisville" },
  { code: "RIC", city: "Richmond", name: "Richmond International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "ORF", city: "Norfolk", name: "Norfolk International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "BDL", city: "Hartford", name: "Bradley International Airport", country: "United States", timeZone: "America/New_York" },
  { code: "PWM", city: "Portland", name: "Portland International Jetport", country: "United States", timeZone: "America/New_York", aliases: ["Portland Maine"] },
  { code: "ANC", city: "Anchorage", name: "Ted Stevens Anchorage International Airport", country: "United States", timeZone: "America/Anchorage" },
  { code: "HNL", city: "Honolulu", name: "Daniel K. Inouye International Airport", country: "United States", timeZone: "Pacific/Honolulu" },
  { code: "OGG", city: "Kahului", name: "Kahului Airport", country: "United States", timeZone: "Pacific/Honolulu" },
  // Canada
  { code: "YYZ", city: "Toronto", name: "Toronto Pearson International Airport", country: "Canada", timeZone: "America/Toronto", metroCode: "YTO" },
  { code: "YTZ", city: "Toronto", name: "Billy Bishop Toronto City Airport", country: "Canada", timeZone: "America/Toronto", metroCode: "YTO" },
  { code: "YUL", city: "Montreal", name: "Montréal-Trudeau International Airport", country: "Canada", timeZone: "America/Toronto" },
  { code: "YOW", city: "Ottawa", name: "Ottawa International Airport", country: "Canada", timeZone: "America/Toronto" },
  { code: "YVR", city: "Vancouver", name: "Vancouver International Airport", country: "Canada", timeZone: "America/Vancouver" },
  { code: "YYC", city: "Calgary", name: "Calgary International Airport", country: "Canada", timeZone: "America/Edmonton" },
  { code: "YEG", city: "Edmonton", name: "Edmonton International Airport", country: "Canada", timeZone: "America/Edmonton" },
  { code: "YHZ", city: "Halifax", name: "Halifax Stanfield International Airport", country: "Canada", timeZone: "America/Halifax" },
  { code: "YQB", city: "Quebec City", name: "Québec City Jean Lesage International Airport", country: "Canada", timeZone: "America/Toronto" },
  // Mexico and Caribbean
  { code: "CUN", city: "Cancún", name: "Cancún International Airport", country: "Mexico", timeZone: "America/Cancun" },
  { code: "MEX", city: "Mexico City", name: "Mexico City International Airport", country: "Mexico", timeZone: "America/Mexico_City" },
  { code: "GDL", city: "Guadalajara", name: "Guadalajara International Airport", country: "Mexico", timeZone: "America/Mexico_City" },
  { code: "PVR", city: "Puerto Vallarta", name: "Puerto Vallarta International Airport", country: "Mexico", timeZone: "America/Bahia_Banderas" },
  { code: "SJD", city: "Los Cabos", name: "Los Cabos International Airport", country: "Mexico", timeZone: "America/Mazatlan" },
  { code: "MID", city: "Mérida", name: "Mérida International Airport", country: "Mexico", timeZone: "America/Merida" },
  { code: "OAX", city: "Oaxaca", name: "Oaxaca International Airport", country: "Mexico", timeZone: "America/Mexico_City" },
  { code: "PUJ", city: "Punta Cana", name: "Punta Cana International Airport", country: "Dominican Republic", timeZone: "America/Santo_Domingo" },
  { code: "SDQ", city: "Santo Domingo", name: "Las Américas International Airport", country: "Dominican Republic", timeZone: "America/Santo_Domingo" },
  { code: "POP", city: "Puerto Plata", name: "Gregorio Luperón International Airport", country: "Dominican Republic", timeZone: "America/Santo_Domingo" },
  { code: "STI", city: "Santiago de los Caballeros", name: "Cibao International Airport", country: "Dominican Republic", timeZone: "America/Santo_Domingo", aliases: ["Santiago Dominican Republic"] },
  { code: "LRM", city: "La Romana", name: "La Romana International Airport", country: "Dominican Republic", timeZone: "America/Santo_Domingo" },
  { code: "AZS", city: "Samaná", name: "Samaná El Catey International Airport", country: "Dominican Republic", timeZone: "America/Santo_Domingo", aliases: ["Las Terrenas airport", "El Catey"] },
  { code: "SJU", city: "San Juan", name: "Luis Muñoz Marín International Airport", country: "Puerto Rico", timeZone: "America/Puerto_Rico" },
  { code: "BQN", city: "Aguadilla", name: "Rafael Hernández International Airport", country: "Puerto Rico", timeZone: "America/Puerto_Rico" },
  { code: "MBJ", city: "Montego Bay", name: "Sangster International Airport", country: "Jamaica", timeZone: "America/Jamaica" },
  { code: "KIN", city: "Kingston", name: "Norman Manley International Airport", country: "Jamaica", timeZone: "America/Jamaica" },
  { code: "NAS", city: "Nassau", name: "Lynden Pindling International Airport", country: "Bahamas", timeZone: "America/Nassau" },
  { code: "BGI", city: "Bridgetown", name: "Grantley Adams International Airport", country: "Barbados", timeZone: "America/Barbados" },
  { code: "CUR", city: "Willemstad", name: "Curaçao International Airport", country: "Curaçao", timeZone: "America/Curacao" },
  { code: "SXM", city: "Sint Maarten", name: "Princess Juliana International Airport", country: "Sint Maarten", timeZone: "America/Lower_Princes" },
  { code: "PLS", city: "Providenciales", name: "Providenciales International Airport", country: "Turks and Caicos Islands", timeZone: "America/Grand_Turk" },
  // United Kingdom and Ireland
  { code: "LHR", city: "London", name: "Heathrow Airport", country: "United Kingdom", timeZone: "Europe/London", metroCode: "LON", aliases: ["London Heathrow", "London Heathrow Airport"] },
  { code: "LGW", city: "London", name: "Gatwick Airport", country: "United Kingdom", timeZone: "Europe/London", metroCode: "LON", aliases: ["London Gatwick", "London Gatwick Airport"] },
  { code: "STN", city: "London", name: "Stansted Airport", country: "United Kingdom", timeZone: "Europe/London", metroCode: "LON", aliases: ["London Stansted"] },
  { code: "LTN", city: "London", name: "Luton Airport", country: "United Kingdom", timeZone: "Europe/London", metroCode: "LON", aliases: ["London Luton"] },
  { code: "LCY", city: "London", name: "London City Airport", country: "United Kingdom", timeZone: "Europe/London", metroCode: "LON" },
  { code: "MAN", city: "Manchester", name: "Manchester Airport", country: "United Kingdom", timeZone: "Europe/London" },
  { code: "EDI", city: "Edinburgh", name: "Edinburgh Airport", country: "United Kingdom", timeZone: "Europe/London" },
  { code: "GLA", city: "Glasgow", name: "Glasgow Airport", country: "United Kingdom", timeZone: "Europe/London" },
  { code: "BHX", city: "Birmingham", name: "Birmingham Airport", country: "United Kingdom", timeZone: "Europe/London" },
  { code: "DUB", city: "Dublin", name: "Dublin Airport", country: "Ireland", timeZone: "Europe/Dublin" },
  { code: "SNN", city: "Shannon", name: "Shannon Airport", country: "Ireland", timeZone: "Europe/Dublin" },
  // Western and Central Europe
  { code: "CDG", city: "Paris", name: "Paris Charles de Gaulle Airport", country: "France", timeZone: "Europe/Paris", metroCode: "PAR" },
  { code: "ORY", city: "Paris", name: "Paris Orly Airport", country: "France", timeZone: "Europe/Paris", metroCode: "PAR" },
  { code: "NCE", city: "Nice", name: "Nice Côte d'Azur Airport", country: "France", timeZone: "Europe/Paris" },
  { code: "LYS", city: "Lyon", name: "Lyon-Saint Exupéry Airport", country: "France", timeZone: "Europe/Paris" },
  { code: "MRS", city: "Marseille", name: "Marseille Provence Airport", country: "France", timeZone: "Europe/Paris" },
  { code: "AMS", city: "Amsterdam", name: "Amsterdam Airport Schiphol", country: "Netherlands", timeZone: "Europe/Amsterdam" },
  { code: "EIN", city: "Eindhoven", name: "Eindhoven Airport", country: "Netherlands", timeZone: "Europe/Amsterdam" },
  { code: "BRU", city: "Brussels", name: "Brussels Airport", country: "Belgium", timeZone: "Europe/Brussels" },
  { code: "FRA", city: "Frankfurt", name: "Frankfurt Airport", country: "Germany", timeZone: "Europe/Berlin" },
  { code: "MUC", city: "Munich", name: "Munich Airport", country: "Germany", timeZone: "Europe/Berlin" },
  { code: "BER", city: "Berlin", name: "Berlin Brandenburg Airport", country: "Germany", timeZone: "Europe/Berlin" },
  { code: "DUS", city: "Düsseldorf", name: "Düsseldorf Airport", country: "Germany", timeZone: "Europe/Berlin" },
  { code: "HAM", city: "Hamburg", name: "Hamburg Airport", country: "Germany", timeZone: "Europe/Berlin" },
  { code: "STR", city: "Stuttgart", name: "Stuttgart Airport", country: "Germany", timeZone: "Europe/Berlin" },
  { code: "CGN", city: "Cologne", name: "Cologne Bonn Airport", country: "Germany", timeZone: "Europe/Berlin" },
  { code: "ZRH", city: "Zurich", name: "Zurich Airport", country: "Switzerland", timeZone: "Europe/Zurich" },
  { code: "GVA", city: "Geneva", name: "Geneva Airport", country: "Switzerland", timeZone: "Europe/Zurich" },
  { code: "BSL", city: "Basel", name: "EuroAirport Basel-Mulhouse-Freiburg", country: "Switzerland", timeZone: "Europe/Zurich" },
  { code: "VIE", city: "Vienna", name: "Vienna International Airport", country: "Austria", timeZone: "Europe/Vienna" },
  // Southern Europe
  { code: "FCO", city: "Rome", name: "Rome Fiumicino Airport", country: "Italy", timeZone: "Europe/Rome", metroCode: "ROM" },
  { code: "CIA", city: "Rome", name: "Rome Ciampino Airport", country: "Italy", timeZone: "Europe/Rome", metroCode: "ROM" },
  { code: "MXP", city: "Milan", name: "Milan Malpensa Airport", country: "Italy", timeZone: "Europe/Rome", metroCode: "MIL" },
  { code: "LIN", city: "Milan", name: "Milan Linate Airport", country: "Italy", timeZone: "Europe/Rome", metroCode: "MIL" },
  { code: "VCE", city: "Venice", name: "Venice Marco Polo Airport", country: "Italy", timeZone: "Europe/Rome" },
  { code: "NAP", city: "Naples", name: "Naples International Airport", country: "Italy", timeZone: "Europe/Rome" },
  { code: "BLQ", city: "Bologna", name: "Bologna Guglielmo Marconi Airport", country: "Italy", timeZone: "Europe/Rome" },
  { code: "CTA", city: "Catania", name: "Catania Fontanarossa Airport", country: "Italy", timeZone: "Europe/Rome" },
  { code: "MAD", city: "Madrid", name: "Adolfo Suárez Madrid-Barajas Airport", country: "Spain", timeZone: "Europe/Madrid" },
  { code: "BCN", city: "Barcelona", name: "Barcelona-El Prat Airport", country: "Spain", timeZone: "Europe/Madrid" },
  { code: "AGP", city: "Málaga", name: "Málaga-Costa del Sol Airport", country: "Spain", timeZone: "Europe/Madrid" },
  { code: "PMI", city: "Palma de Mallorca", name: "Palma de Mallorca Airport", country: "Spain", timeZone: "Europe/Madrid" },
  { code: "VLC", city: "Valencia", name: "Valencia Airport", country: "Spain", timeZone: "Europe/Madrid" },
  { code: "ALC", city: "Alicante", name: "Alicante-Elche Airport", country: "Spain", timeZone: "Europe/Madrid" },
  { code: "IBZ", city: "Ibiza", name: "Ibiza Airport", country: "Spain", timeZone: "Europe/Madrid" },
  { code: "SVQ", city: "Seville", name: "Seville Airport", country: "Spain", timeZone: "Europe/Madrid" },
  { code: "LIS", city: "Lisbon", name: "Humberto Delgado Airport", country: "Portugal", timeZone: "Europe/Lisbon" },
  { code: "OPO", city: "Porto", name: "Francisco Sá Carneiro Airport", country: "Portugal", timeZone: "Europe/Lisbon" },
  { code: "FAO", city: "Faro", name: "Faro Airport", country: "Portugal", timeZone: "Europe/Lisbon" },
  { code: "FNC", city: "Funchal", name: "Madeira Airport", country: "Portugal", timeZone: "Atlantic/Madeira" },
  { code: "ATH", city: "Athens", name: "Athens International Airport", country: "Greece", timeZone: "Europe/Athens" },
  { code: "SKG", city: "Thessaloniki", name: "Thessaloniki Airport", country: "Greece", timeZone: "Europe/Athens" },
  { code: "HER", city: "Heraklion", name: "Heraklion International Airport", country: "Greece", timeZone: "Europe/Athens" },
  { code: "RHO", city: "Rhodes", name: "Rhodes International Airport", country: "Greece", timeZone: "Europe/Athens" },
  { code: "CFU", city: "Corfu", name: "Corfu International Airport", country: "Greece", timeZone: "Europe/Athens" },
  { code: "IST", city: "Istanbul", name: "Istanbul Airport", country: "Turkey", timeZone: "Europe/Istanbul", metroCode: "IST" },
  { code: "SAW", city: "Istanbul", name: "Istanbul Sabiha Gökçen Airport", country: "Turkey", timeZone: "Europe/Istanbul", metroCode: "IST" },
  { code: "AYT", city: "Antalya", name: "Antalya Airport", country: "Turkey", timeZone: "Europe/Istanbul" },
  { code: "ADB", city: "Izmir", name: "Adnan Menderes Airport", country: "Turkey", timeZone: "Europe/Istanbul" },
  { code: "KEF", city: "Reykjavík", name: "Keflavík International Airport", country: "Iceland", timeZone: "Atlantic/Reykjavik" },
  // Central and Eastern Europe
  { code: "WAW", city: "Warsaw", name: "Warsaw Chopin Airport", country: "Poland", timeZone: "Europe/Warsaw" },
  { code: "KRK", city: "Kraków", name: "Kraków John Paul II International Airport", country: "Poland", timeZone: "Europe/Warsaw" },
  { code: "PRG", city: "Prague", name: "Václav Havel Airport Prague", country: "Czechia", timeZone: "Europe/Prague" },
  { code: "BUD", city: "Budapest", name: "Budapest Ferenc Liszt International Airport", country: "Hungary", timeZone: "Europe/Budapest" },
  { code: "OTP", city: "Bucharest", name: "Henri Coandă International Airport", country: "Romania", timeZone: "Europe/Bucharest" },
  { code: "SOF", city: "Sofia", name: "Sofia Airport", country: "Bulgaria", timeZone: "Europe/Sofia" },
  { code: "CPH", city: "Copenhagen", name: "Copenhagen Airport", country: "Denmark", timeZone: "Europe/Copenhagen" },
  { code: "ARN", city: "Stockholm", name: "Stockholm Arlanda Airport", country: "Sweden", timeZone: "Europe/Stockholm" },
  { code: "OSL", city: "Oslo", name: "Oslo Gardermoen Airport", country: "Norway", timeZone: "Europe/Oslo" },
  { code: "HEL", city: "Helsinki", name: "Helsinki Airport", country: "Finland", timeZone: "Europe/Helsinki" },
  { code: "TIA", city: "Tirana", name: "Tirana International Airport", country: "Albania", timeZone: "Europe/Tirane", aliases: ["Rinas Airport"] },
  // Asia and Middle East
  { code: "HND", city: "Tokyo", name: "Tokyo Haneda Airport", country: "Japan", timeZone: "Asia/Tokyo", metroCode: "TYO" },
  { code: "NRT", city: "Tokyo", name: "Tokyo Narita International Airport", country: "Japan", timeZone: "Asia/Tokyo", metroCode: "TYO" },
  { code: "KIX", city: "Osaka", name: "Kansai International Airport", country: "Japan", timeZone: "Asia/Tokyo" },
  { code: "NGO", city: "Nagoya", name: "Chubu Centrair International Airport", country: "Japan", timeZone: "Asia/Tokyo" },
  { code: "FUK", city: "Fukuoka", name: "Fukuoka Airport", country: "Japan", timeZone: "Asia/Tokyo" },
  { code: "CTS", city: "Sapporo", name: "New Chitose Airport", country: "Japan", timeZone: "Asia/Tokyo" },
  { code: "ICN", city: "Seoul", name: "Incheon International Airport", country: "South Korea", timeZone: "Asia/Seoul", metroCode: "SEL" },
  { code: "GMP", city: "Seoul", name: "Gimpo International Airport", country: "South Korea", timeZone: "Asia/Seoul", metroCode: "SEL" },
  { code: "PUS", city: "Busan", name: "Gimhae International Airport", country: "South Korea", timeZone: "Asia/Seoul" },
  { code: "HKG", city: "Hong Kong", name: "Hong Kong International Airport", country: "Hong Kong", timeZone: "Asia/Hong_Kong" },
  { code: "SIN", city: "Singapore", name: "Singapore Changi Airport", country: "Singapore", timeZone: "Asia/Singapore" },
  { code: "BKK", city: "Bangkok", name: "Suvarnabhumi Airport", country: "Thailand", timeZone: "Asia/Bangkok", metroCode: "BKK" },
  { code: "DMK", city: "Bangkok", name: "Don Mueang International Airport", country: "Thailand", timeZone: "Asia/Bangkok", metroCode: "BKK" },
  { code: "HKT", city: "Phuket", name: "Phuket International Airport", country: "Thailand", timeZone: "Asia/Bangkok" },
  { code: "KUL", city: "Kuala Lumpur", name: "Kuala Lumpur International Airport", country: "Malaysia", timeZone: "Asia/Kuala_Lumpur" },
  { code: "DPS", city: "Denpasar", name: "I Gusti Ngurah Rai International Airport", country: "Indonesia", timeZone: "Asia/Makassar", aliases: ["Bali airport"] },
  { code: "CGK", city: "Jakarta", name: "Soekarno-Hatta International Airport", country: "Indonesia", timeZone: "Asia/Jakarta" },
  { code: "MNL", city: "Manila", name: "Ninoy Aquino International Airport", country: "Philippines", timeZone: "Asia/Manila" },
  { code: "SGN", city: "Ho Chi Minh City", name: "Tan Son Nhat International Airport", country: "Vietnam", timeZone: "Asia/Ho_Chi_Minh" },
  { code: "HAN", city: "Hanoi", name: "Noi Bai International Airport", country: "Vietnam", timeZone: "Asia/Ho_Chi_Minh" },
  { code: "DEL", city: "Delhi", name: "Indira Gandhi International Airport", country: "India", timeZone: "Asia/Kolkata" },
  { code: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji Maharaj International Airport", country: "India", timeZone: "Asia/Kolkata" },
  { code: "BLR", city: "Bengaluru", name: "Kempegowda International Airport", country: "India", timeZone: "Asia/Kolkata" },
  { code: "MAA", city: "Chennai", name: "Chennai International Airport", country: "India", timeZone: "Asia/Kolkata" },
  { code: "DXB", city: "Dubai", name: "Dubai International Airport", country: "United Arab Emirates", timeZone: "Asia/Dubai" },
  { code: "AUH", city: "Abu Dhabi", name: "Zayed International Airport", country: "United Arab Emirates", timeZone: "Asia/Dubai" },
  { code: "SHJ", city: "Sharjah", name: "Sharjah International Airport", country: "United Arab Emirates", timeZone: "Asia/Dubai" },
  { code: "DOH", city: "Doha", name: "Hamad International Airport", country: "Qatar", timeZone: "Asia/Qatar" },
  { code: "MCT", city: "Muscat", name: "Muscat International Airport", country: "Oman", timeZone: "Asia/Muscat" },
  { code: "PEK", city: "Beijing", name: "Beijing Capital International Airport", country: "China", timeZone: "Asia/Shanghai", metroCode: "BJS" },
  { code: "PKX", city: "Beijing", name: "Beijing Daxing International Airport", country: "China", timeZone: "Asia/Shanghai", metroCode: "BJS" },
  { code: "PVG", city: "Shanghai", name: "Shanghai Pudong International Airport", country: "China", timeZone: "Asia/Shanghai" },
  { code: "CAN", city: "Guangzhou", name: "Guangzhou Baiyun International Airport", country: "China", timeZone: "Asia/Shanghai" },
  { code: "TPE", city: "Taipei", name: "Taiwan Taoyuan International Airport", country: "Taiwan", timeZone: "Asia/Taipei" },
  // Latin America and Africa
  { code: "PTY", city: "Panama City", name: "Tocumen International Airport", country: "Panama", timeZone: "America/Panama" },
  { code: "BOG", city: "Bogotá", name: "El Dorado International Airport", country: "Colombia", timeZone: "America/Bogota" },
  { code: "MDE", city: "Medellín", name: "José María Córdova International Airport", country: "Colombia", timeZone: "America/Bogota" },
  { code: "GRU", city: "São Paulo", name: "São Paulo-Guarulhos International Airport", country: "Brazil", timeZone: "America/Sao_Paulo" },
  { code: "GIG", city: "Rio de Janeiro", name: "Rio de Janeiro-Galeão International Airport", country: "Brazil", timeZone: "America/Sao_Paulo" },
  { code: "EZE", city: "Buenos Aires", name: "Ministro Pistarini International Airport", country: "Argentina", timeZone: "America/Argentina/Buenos_Aires" },
  { code: "SCL", city: "Santiago", name: "Arturo Merino Benítez International Airport", country: "Chile", timeZone: "America/Santiago" },
  { code: "LIM", city: "Lima", name: "Jorge Chávez International Airport", country: "Peru", timeZone: "America/Lima" },
  { code: "UIO", city: "Quito", name: "Mariscal Sucre International Airport", country: "Ecuador", timeZone: "America/Guayaquil" },
  { code: "CMN", city: "Casablanca", name: "Mohammed V International Airport", country: "Morocco", timeZone: "Africa/Casablanca" },
  { code: "RAK", city: "Marrakech", name: "Marrakesh Menara Airport", country: "Morocco", timeZone: "Africa/Casablanca" },
  { code: "CAI", city: "Cairo", name: "Cairo International Airport", country: "Egypt", timeZone: "Africa/Cairo" },
  { code: "JNB", city: "Johannesburg", name: "O. R. Tambo International Airport", country: "South Africa", timeZone: "Africa/Johannesburg" },
  { code: "CPT", city: "Cape Town", name: "Cape Town International Airport", country: "South Africa", timeZone: "Africa/Johannesburg" },
  { code: "NBO", city: "Nairobi", name: "Jomo Kenyatta International Airport", country: "Kenya", timeZone: "Africa/Nairobi" },
  { code: "ADD", city: "Addis Ababa", name: "Bole International Airport", country: "Ethiopia", timeZone: "Africa/Addis_Ababa" },
];

export const AIRPORT_DIRECTORY: AirportDirectoryEntry[] = AIRPORT_ROWS;

export type AirportMetroGroup = {
  code: string;
  city: string;
  country: string;
  airportCodes: string[];
  aliases: string[];
};

/** Recognized multi-airport city codes supported by Google Flights. */
export const AIRPORT_METRO_GROUPS: AirportMetroGroup[] = [
  { code: "NYC", city: "New York", country: "United States", airportCodes: ["JFK", "EWR", "LGA"], aliases: ["nyc", "new york city", "new york metro"] },
  { code: "WAS", city: "Washington", country: "United States", airportCodes: ["DCA", "IAD", "BWI"], aliases: ["washington dc", "washington d c", "dc metro"] },
  { code: "CHI", city: "Chicago", country: "United States", airportCodes: ["ORD", "MDW"], aliases: ["chicago metro"] },
  { code: "LON", city: "London", country: "United Kingdom", airportCodes: ["LHR", "LGW", "STN", "LTN", "LCY"], aliases: ["london metro", "greater london"] },
  { code: "PAR", city: "Paris", country: "France", airportCodes: ["CDG", "ORY"], aliases: ["paris metro"] },
  { code: "ROM", city: "Rome", country: "Italy", airportCodes: ["FCO", "CIA"], aliases: ["rome metro"] },
  { code: "TYO", city: "Tokyo", country: "Japan", airportCodes: ["HND", "NRT"], aliases: ["tokyo metro"] },
  { code: "YTO", city: "Toronto", country: "Canada", airportCodes: ["YYZ", "YTZ"], aliases: ["toronto metro"] },
  { code: "MIL", city: "Milan", country: "Italy", airportCodes: ["MXP", "LIN"], aliases: ["milan metro"] },
  { code: "SEL", city: "Seoul", country: "South Korea", airportCodes: ["ICN", "GMP"], aliases: ["seoul metro"] },
  { code: "BJS", city: "Beijing", country: "China", airportCodes: ["PEK", "PKX"], aliases: ["beijing metro"] },
];

function normalizeAirportText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const metroAliases = new Map<string, string>();
for (const group of AIRPORT_METRO_GROUPS) {
  for (const alias of [group.code, group.city, ...group.aliases]) metroAliases.set(normalizeAirportText(alias), group.code);
}

const cityCodes: Record<string, string> = {
  "new york": "NYC", "new york city": "NYC", "new york ny": "NYC", nyc: "NYC", "nyc metro": "NYC", manhattan: "NYC", queens: "NYC",
  newark: "EWR", "newark nj": "EWR", "newark new jersey": "EWR", "john f kennedy": "JFK", "jfk airport": "JFK", "la guardia": "LGA",
  boston: "BOS", philadelphia: "PHL", philly: "PHL", "washington dc": "WAS", washington: "WAS", dc: "WAS", baltimore: "BWI",
  atlanta: "ATL", miami: "MIA", "fort lauderdale": "FLL", orlando: "MCO", tampa: "TPA", chicago: "CHI", "los angeles": "LAX",
  lax: "LAX", "san francisco": "SFO", seattle: "SEA", denver: "DEN", dallas: "DFW", houston: "HOU", phoenix: "PHX", charlotte: "CLT",
  detroit: "DTW", minneapolis: "MSP", "san diego": "SAN", austin: "AUS", nashville: "BNA", toronto: "YTO", montreal: "YUL",
  vancouver: "YVR", london: "LON", paris: "PAR", rome: "ROM", tokyo: "TYO", "las vegas": "LAS", "san juan": "SJU", cancun: "CUN",
  "mexico city": "MEX", "las terrenas": "AZS", samana: "AZS", "samaná": "AZS", albania: "TIA", tirana: "TIA", "tirana albania": "TIA",
  "tirana international airport": "TIA", durres: "TIA", "durres albania": "TIA", sarande: "TIA", "sarande albania": "TIA", vlore: "TIA",
  "vlore albania": "TIA", shkoder: "TIA", "shkoder albania": "TIA", berat: "TIA", "berat albania": "TIA", "london heathrow": "LHR",
  heathrow: "LHR", "paris charles de gaulle": "CDG", amsterdam: "AMS", frankfurt: "FRA", istanbul: "IST", dubai: "DXB", doha: "DOH", singapore: "SIN",
  lisbon: "LIS", porto: "OPO", madrid: "MAD", barcelona: "BCN", milan: "MIL", venice: "VCE", naples: "NAP", athens: "ATH", thessaloniki: "SKG",
  munich: "MUC", berlin: "BER", zurich: "ZRH", geneva: "GVA", dublin: "DUB", edinburgh: "EDI", manchester: "MAN", stockholm: "ARN", oslo: "OSL",
  helsinki: "HEL", prague: "PRG", budapest: "BUD", warsaw: "WAW", guadalajara: "GDL", "puerto vallarta": "PVR", "los cabos": "SJD",
  "santiago de los caballeros": "STI", "punta cana": "PUJ", "santo domingo": "SDQ", "puerto plata": "POP", "montego bay": "MBJ",
  kingston: "KIN", jakarta: "CGK", bali: "DPS", denpasar: "DPS", "ho chi minh city": "SGN", hanoi: "HAN", manila: "MNL", "kuala lumpur": "KUL",
  delhi: "DEL", mumbai: "BOM", bengaluru: "BLR", beijing: "BJS", shanghai: "PVG", "hong kong": "HKG", seoul: "SEL", osaka: "KIX", nagoya: "NGO",
  guangzhou: "CAN", "abu dhabi": "AUH", sharjah: "SHJ", muscat: "MCT", panama: "PTY", "panama city": "PTY", bogota: "BOG", medellin: "MDE",
  "sao paulo": "GRU", "rio de janeiro": "GIG", "buenos aires": "EZE", santiago: "SCL", lima: "LIM", quito: "UIO", casablanca: "CMN", marrakech: "RAK",
  cairo: "CAI", johannesburg: "JNB", "cape town": "CPT", nairobi: "NBO", "addis ababa": "ADD",
};

/** Return the metro or airport code for a city, airport name, alias or IATA code. */
export function resolveAirportCode(input: string): string | null {
  const clean = input.trim();
  if (/^[a-zA-Z]{3}$/.test(clean)) return clean.toUpperCase();
  const parentheticalCode = clean.match(/\(([a-zA-Z]{3})\)\s*$/)?.[1]?.toUpperCase();
  if (parentheticalCode) return parentheticalCode;
  const normalized = normalizeAirportText(clean.replace(/\s*\([^)]*\)\s*/g, " "));
  if (!normalized) return null;
  if (cityCodes[normalized]) return cityCodes[normalized];
  if (metroAliases.has(normalized)) return metroAliases.get(normalized) ?? null;
  const cityOnly = normalizeAirportText(clean.split(",")[0] || clean);
  if (metroAliases.has(cityOnly)) return metroAliases.get(cityOnly) ?? null;
  const exactAirport = AIRPORT_DIRECTORY.find((airport) =>
    [airport.name, airport.city, ...(airport.aliases ?? [])].some((value) => normalizeAirportText(value) === normalized || normalizeAirportText(value) === cityOnly)
  );
  return exactAirport?.code ?? null;
}

/** Search airport codes, official airport names, cities and curated aliases locally. */
export function searchAirportDirectory(query: string, limit = 16): AirportDirectoryEntry[] {
  const normalized = normalizeAirportText(query);
  if (normalized.length < 2) return [];
  const matches = AIRPORT_DIRECTORY.filter((airport) =>
    [airport.code, airport.city, airport.name, ...(airport.aliases ?? [])].some((value) => normalizeAirportText(value).includes(normalized))
  );
  return matches.sort((a, b) => {
    const score = (airport: AirportDirectoryEntry) => {
      const code = normalizeAirportText(airport.code);
      const city = normalizeAirportText(airport.city);
      const name = normalizeAirportText(airport.name);
      if (code === normalized) return 0;
      if (city === normalized) return 1;
      if (name === normalized) return 2;
      if (city.startsWith(normalized) || name.startsWith(normalized)) return 3;
      return 4;
    };
    return score(a) - score(b) || a.city.localeCompare(b.city) || a.code.localeCompare(b.code);
  }).slice(0, Math.max(1, Math.min(40, limit)));
}

export function getAirportMetroGroup(value: string): AirportMetroGroup | undefined {
  const normalized = normalizeAirportText(value);
  const cityOnly = normalizeAirportText(value.split(",")[0] || value);
  return AIRPORT_METRO_GROUPS.find((group) => [group.code, group.city, ...group.aliases].some((alias) => {
    const key = normalizeAirportText(alias);
    return key === normalized || key === cityOnly;
  }));
}
