import type { Destination, TripStyle } from "./types";

const common = {
  sourceNote: "Curated destination guidance. Local opening hours, events, transport changes and entry rules must be rechecked before travel.",
};

export const DESTINATIONS: Destination[] = [
  {
    ...common, id: "lisbon", city: "Lisbon", country: "Portugal", airportCode: "LIS", airportLabel: "Lisbon Humberto Delgado (LIS)",
    image: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1400&q=88",
    summary: "A relaxed city break built around neighbourhood walks, viewpoints, food and easy coastal day trips.",
    bestFor: ["Food and neighbourhoods", "Historic streets", "Coastal day trips"], styles: ["city", "food", "culture", "romantic"], costLevel: 2, suggestedNights: [3, 6], goodMonths: [3,4,5,6,8,9,10],
    highlights: ["Alfama and Baixa", "Belém waterfront", "Sintra or Cascais day trip"],
    itinerary: [
      [{title:"Explore Baixa and Chiado",description:"Get oriented on foot through the central squares, lanes and cafés.",category:"Neighbourhood"},{title:"Ride or walk toward Alfama",description:"Explore the older quarter at an unhurried pace and choose a viewpoint.",category:"Culture"},{title:"Dinner close to your stay",description:"Keep the first evening flexible after the journey.",category:"Food"}],
      [{title:"Belém riverside",description:"Plan time for the waterfront and nearby monuments; verify ticketing and opening hours.",category:"History"},{title:"Lunch and a pastry stop",description:"Leave room for a longer meal rather than over-scheduling.",category:"Food"},{title:"Sunset viewpoint",description:"Choose a miradouro based on your hotel location.",category:"Scenic"}],
      [{title:"Choose a day trip",description:"Consider Sintra for palaces and gardens or Cascais for a coastal change of pace.",category:"Day trip"},{title:"Return to the city",description:"Allow enough time for the return journey and a relaxed afternoon.",category:"Leisure"},{title:"Local dinner",description:"Explore a neighbourhood restaurant and keep the evening open.",category:"Food"}],
    ],
  },
  {
    ...common, id: "cancun", city: "Cancún", country: "Mexico", airportCode: "CUN", airportLabel: "Cancún International (CUN)",
    image: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1400&q=88",
    summary: "A beach-focused base with resort options, cenotes, islands and access to Yucatán highlights.",
    bestFor: ["Beach time", "Resorts", "Water activities"], styles: ["beach", "family", "romantic", "adventure"], costLevel: 3, suggestedNights: [4, 7], goodMonths: [1,2,3,4,11,12],
    highlights: ["Hotel Zone beaches", "Isla Mujeres", "Cenotes and Mayan sites"],
    itinerary: [
      [{title:"Settle in by the water",description:"Keep arrival day light and confirm transfer time before selecting evening plans.",category:"Beach"},{title:"Beach or pool afternoon",description:"Use this as a recovery window after travel.",category:"Leisure"},{title:"Dinner near your hotel",description:"Check transport options and resort dining arrangements.",category:"Food"}],
      [{title:"Isla Mujeres day",description:"Compare ferry departure points and operating schedules before leaving.",category:"Island"},{title:"Explore the island",description:"Choose a beach area or a short local outing rather than trying to cover everything.",category:"Explore"},{title:"Return to Cancún",description:"Build in a buffer for the ferry and transfer back.",category:"Transport"}],
      [{title:"Cenote or cultural excursion",description:"Select a guided trip that matches your comfort with driving and activity level.",category:"Adventure"},{title:"Slow afternoon",description:"Leave time to relax and avoid stacking too many excursions.",category:"Leisure"},{title:"Dinner reservation",description:"Check whether reservations or transport are required.",category:"Food"}],
    ],
  },
  {
    ...common, id: "san-juan", city: "San Juan", country: "Puerto Rico", airportCode: "SJU", airportLabel: "Luis Muñoz Marín International (SJU)",
    image: "https://images.unsplash.com/photo-1605216663980-6b5e3b5f5b20?auto=format&fit=crop&w=1400&q=88",
    summary: "A flexible Caribbean city-and-beach break with historic streets, local food and nearby nature.",
    bestFor: ["Caribbean without a passport for US citizens", "History and food", "Beach plus city"], styles: ["beach", "city", "food", "culture", "family", "romantic"], costLevel: 3, suggestedNights: [3, 6], goodMonths: [1,2,3,4,12],
    highlights: ["Old San Juan", "Condado and Isla Verde", "El Yunque day trip"],
    itinerary: [
      [{title:"Old San Juan orientation",description:"Walk the historic streets and waterfront; check attraction hours separately.",category:"Culture"},{title:"Fortress and plaza time",description:"Choose one major historic site and leave room for wandering.",category:"History"},{title:"Dinner in Old San Juan",description:"Explore local Puerto Rican dishes.",category:"Food"}],
      [{title:"Beach morning",description:"Choose a beach based on surf conditions and the facilities you need.",category:"Beach"},{title:"Local lunch",description:"Explore a nearby neighbourhood rather than crossing the city at midday.",category:"Food"},{title:"Sunset along the coast",description:"Keep the evening easy and close to your base.",category:"Leisure"}],
      [{title:"Nature excursion",description:"Consider El Yunque with a licensed guide or confirmed transport plan.",category:"Nature"},{title:"Return and rest",description:"Allow for traffic and weather-related changes.",category:"Leisure"},{title:"Final evening",description:"Pick a restaurant based on your departure time the next day.",category:"Food"}],
    ],
  },
  {
    ...common, id: "mexico-city", city: "Mexico City", country: "Mexico", airportCode: "MEX", airportLabel: "Mexico City International (MEX)",
    image: "https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?auto=format&fit=crop&w=1400&q=88",
    summary: "A culture-rich city break with world-class food, museums, architecture and distinctive neighbourhoods.",
    bestFor: ["Food and museums", "Architecture", "Neighbourhood exploration"], styles: ["city", "food", "culture", "adventure"], costLevel: 2, suggestedNights: [3, 6], goodMonths: [2,3,4,10,11,12],
    highlights: ["Roma and Condesa", "Centro Histórico", "Chapultepec and museums"],
    itinerary: [
      [{title:"Roma and Condesa",description:"Get oriented around parks, cafés and neighbourhood streets.",category:"Neighbourhood"},{title:"Choose a museum",description:"Check official opening days and timed-ticket requirements.",category:"Culture"},{title:"Dinner reservation",description:"Book ahead for high-demand restaurants.",category:"Food"}],
      [{title:"Centro Histórico",description:"Explore the central square and nearby historic buildings.",category:"History"},{title:"Market or food tour",description:"Choose a reputable operator and check the meeting location.",category:"Food"},{title:"Evening in your neighbourhood",description:"Keep travel time and traffic in mind.",category:"Leisure"}],
      [{title:"Chapultepec area",description:"Combine park time with a museum that matches your interests.",category:"Nature"},{title:"Free afternoon",description:"Leave room for shopping, cafés or a rest.",category:"Leisure"},{title:"Final dinner",description:"Choose somewhere convenient for your next day's departure.",category:"Food"}],
    ],
  },
  {
    ...common, id: "punta-cana", city: "Punta Cana", country: "Dominican Republic", airportCode: "PUJ", airportLabel: "Punta Cana International (PUJ)",
    image: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1400&q=88",
    summary: "A resort-oriented beach escape with optional excursions, boating and low-key days.",
    bestFor: ["All-inclusive resorts", "Beach and pools", "Couples and families"], styles: ["beach", "family", "romantic"], costLevel: 2, suggestedNights: [4, 7], goodMonths: [1,2,3,4,11,12],
    highlights: ["Bávaro coast", "Saona Island excursions", "Resort dining and pools"],
    itinerary: [
      [{title:"Resort arrival and orientation",description:"Confirm airport transfer and included meal or activity arrangements.",category:"Arrival"},{title:"Beach or pool time",description:"Keep the first afternoon unscheduled.",category:"Leisure"},{title:"Dinner at the resort",description:"Check whether specialty restaurants require reservations.",category:"Food"}],
      [{title:"Choose one excursion",description:"Compare operator inclusions, pickup times and cancellation terms.",category:"Excursion"},{title:"Relaxed afternoon",description:"Avoid scheduling a second paid activity on the same day.",category:"Leisure"},{title:"Evening at your own pace",description:"Review resort entertainment schedules if interested.",category:"Entertainment"}],
      [{title:"Unscheduled beach day",description:"Keep this day open for flexibility and rest.",category:"Beach"},{title:"Optional local experience",description:"Choose based on transport and accessibility needs.",category:"Explore"},{title:"Pack and confirm transfer",description:"Verify pickup time with the transfer provider.",category:"Departure prep"}],
    ],
  },
  {
    ...common, id: "montego-bay", city: "Montego Bay", country: "Jamaica", airportCode: "MBJ", airportLabel: "Sangster International (MBJ)",
    image: "https://images.unsplash.com/photo-1580541631971-a0e6f9a3f6e7?auto=format&fit=crop&w=1400&q=88",
    summary: "A Caribbean base for resort downtime, beaches, food and carefully planned excursions.",
    bestFor: ["Beach stays", "Resort vacations", "Guided excursions"], styles: ["beach", "family", "romantic", "food"], costLevel: 3, suggestedNights: [4, 7], goodMonths: [1,2,3,4,12],
    highlights: ["Doctor's Cave Beach", "Rose Hall area", "Martha Brae rafting excursions"],
    itinerary: [
      [{title:"Arrival and resort check-in",description:"Confirm transport and arrival-day check-in arrangements.",category:"Arrival"},{title:"Beach afternoon",description:"Choose a beach with the services and access you need.",category:"Beach"},{title:"Jamaican dinner",description:"Explore local cuisine at a convenient location.",category:"Food"}],
      [{title:"Guided river or cultural excursion",description:"Use a reputable operator and verify pickup details.",category:"Excursion"},{title:"Return and relax",description:"Leave a generous return buffer.",category:"Leisure"},{title:"Resort evening",description:"Check event schedules and reservation rules.",category:"Entertainment"}],
      [{title:"Beach or local market",description:"Keep the plan flexible depending on weather and transport.",category:"Explore"},{title:"Free afternoon",description:"Leave time for rest or a spa appointment.",category:"Leisure"},{title:"Confirm departure transfer",description:"Verify airline check-in and airport transfer timing.",category:"Departure prep"}],
    ],
  },
  {
    ...common, id: "orlando", city: "Orlando", country: "United States", airportCode: "MCO", airportLabel: "Orlando International (MCO)",
    image: "https://images.unsplash.com/photo-1560258018-c7db7645254e?auto=format&fit=crop&w=1400&q=88",
    summary: "A family-friendly destination with theme parks, entertainment, shopping and resort options.",
    bestFor: ["Families", "Theme parks", "Multi-day activity trips"], styles: ["family", "adventure"], costLevel: 3, suggestedNights: [4, 7], goodMonths: [1,2,3,4,10,11,12],
    highlights: ["Walt Disney World area", "Universal Orlando area", "Resort pool days"],
    itinerary: [
      [{title:"Arrival and hotel check-in",description:"Confirm park transportation and resort fees before arrival.",category:"Arrival"},{title:"Pool or rest time",description:"Keep the first day light after travel.",category:"Leisure"},{title:"Plan park days",description:"Review official park calendars and ticket rules.",category:"Planning"}],
      [{title:"Theme park day",description:"Choose one park and prioritize age-appropriate attractions.",category:"Theme park"},{title:"Scheduled rest break",description:"Plan meals and hydration into the day.",category:"Break"},{title:"Early evening",description:"Avoid overloading the first full day.",category:"Leisure"}],
      [{title:"Second park or flexible day",description:"Use your family's energy level to decide whether to visit another park or rest.",category:"Theme park"},{title:"Shopping or pool time",description:"Keep this flexible.",category:"Leisure"},{title:"Prepare for departure",description:"Check transport and checkout timing.",category:"Departure prep"}],
    ],
  },
  {
    ...common, id: "new-orleans", city: "New Orleans", country: "United States", airportCode: "MSY", airportLabel: "Louis Armstrong New Orleans (MSY)",
    image: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1400&q=88",
    summary: "A compact cultural getaway built around music, Creole food, architecture and neighbourhood character.",
    bestFor: ["Food", "Live music", "History and culture"], styles: ["food", "city", "culture", "romantic"], costLevel: 2, suggestedNights: [2, 5], goodMonths: [2,3,4,5,10,11],
    highlights: ["French Quarter", "Garden District", "Live music venues"],
    itinerary: [
      [{title:"French Quarter walk",description:"Explore the historic core during daylight and note your route back.",category:"History"},{title:"Creole lunch",description:"Choose a locally recommended restaurant and check hours.",category:"Food"},{title:"Live music",description:"Check venue schedules, age policies and cover charges.",category:"Music"}],
      [{title:"Garden District",description:"Explore residential architecture respectfully and consider a guided walk.",category:"Architecture"},{title:"Museum or riverfront",description:"Choose based on weather and opening days.",category:"Culture"},{title:"Dinner and music",description:"Reserve popular dining and music options where needed.",category:"Food"}],
      [{title:"Market and coffee",description:"Keep the morning flexible.",category:"Food"},{title:"Final neighbourhood visit",description:"Pick a nearby stop based on your accommodation.",category:"Explore"},{title:"Departure preparation",description:"Build in transport time and traffic allowance.",category:"Departure prep"}],
    ],
  },
  {
    ...common, id: "barcelona", city: "Barcelona", country: "Spain", airportCode: "BCN", airportLabel: "Barcelona–El Prat (BCN)",
    image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1400&q=88",
    summary: "A Mediterranean city break mixing architecture, markets, neighbourhoods and beach time.",
    bestFor: ["Architecture", "Food markets", "City and beach"], styles: ["city", "food", "culture", "beach", "romantic"], costLevel: 3, suggestedNights: [3, 6], goodMonths: [4,5,6,9,10],
    highlights: ["Eixample and modernist architecture", "Gothic Quarter", "Waterfront"],
    itinerary: [
      [{title:"Gothic Quarter orientation",description:"Explore the lanes and main squares on foot.",category:"Culture"},{title:"Market lunch",description:"Check market opening days and hours.",category:"Food"},{title:"Waterfront evening",description:"Take a relaxed walk by the sea.",category:"Leisure"}],
      [{title:"Sagrada Família area",description:"Timed tickets are commonly required; confirm directly with the official venue.",category:"Architecture"},{title:"Eixample walk",description:"Explore modernist architecture and cafés.",category:"Neighbourhood"},{title:"Tapas dinner",description:"Reserve popular restaurants in advance.",category:"Food"}],
      [{title:"Park or beach time",description:"Choose based on season, conditions and preference.",category:"Outdoors"},{title:"Free afternoon",description:"Keep time for rest or shopping.",category:"Leisure"},{title:"Final city evening",description:"Choose somewhere near your accommodation.",category:"Food"}],
    ],
  },
  {
    ...common, id: "paris", city: "Paris", country: "France", airportCode: "PAR", airportLabel: "Paris (PAR) — multiple airports", 
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1400&q=88",
    summary: "A walkable culture-and-food trip with museums, gardens, cafés and distinct neighbourhoods.",
    bestFor: ["Museums", "Food and cafés", "Romantic city breaks"], styles: ["city", "food", "culture", "romantic"], costLevel: 4, suggestedNights: [3, 6], goodMonths: [4,5,6,9,10],
    highlights: ["Louvre and Tuileries area", "Le Marais", "Seine riverfront"],
    itinerary: [
      [{title:"Settle into a neighbourhood",description:"Explore local streets and cafés near your accommodation.",category:"Neighbourhood"},{title:"Seine-side walk",description:"Use a flexible route and check river cruise schedules separately.",category:"Scenic"},{title:"Bistro dinner",description:"Reserve where needed.",category:"Food"}],
      [{title:"Museum visit",description:"Choose one major museum and verify opening days and timed entry.",category:"Culture"},{title:"Garden break",description:"Leave a generous break between attractions.",category:"Leisure"},{title:"Evening in Le Marais",description:"Explore dining and shops according to opening hours.",category:"Neighbourhood"}],
      [{title:"Choose a landmark",description:"Plan one major landmark rather than stacking too many timed visits.",category:"Sightseeing"},{title:"Free afternoon",description:"Allow time for cafés or a rest.",category:"Leisure"},{title:"Final dinner",description:"Keep the route back to your stay convenient.",category:"Food"}],
    ],
  },
  {
    ...common, id: "rome", city: "Rome", country: "Italy", airportCode: "ROM", airportLabel: "Rome (ROM) — Fiumicino / Ciampino", 
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1400&q=88",
    summary: "A history-led city escape with major archaeological sites, piazzas and memorable meals.",
    bestFor: ["Ancient history", "Food", "Walkable sightseeing"], styles: ["city", "food", "culture", "romantic"], costLevel: 3, suggestedNights: [3, 6], goodMonths: [3,4,5,9,10,11],
    highlights: ["Colosseum and Forum", "Centro Storico", "Vatican area"],
    itinerary: [
      [{title:"Centro Storico walk",description:"Explore piazzas and fountains with a flexible route.",category:"Sightseeing"},{title:"Lunch close by",description:"Avoid crossing the city for every meal.",category:"Food"},{title:"Evening neighbourhood stroll",description:"Keep the first evening gentle.",category:"Leisure"}],
      [{title:"Colosseum and Forum",description:"Check official timed-entry ticket requirements.",category:"History"},{title:"Rest and lunch",description:"Schedule shade and downtime during warmer months.",category:"Break"},{title:"Trastevere evening",description:"Explore dining options and plan the return route.",category:"Food"}],
      [{title:"Vatican area or Borghese",description:"Choose based on interest and confirmed ticket availability.",category:"Culture"},{title:"Free afternoon",description:"Leave time for a slower pace.",category:"Leisure"},{title:"Final Roman dinner",description:"Reserve in advance if you have a specific restaurant in mind.",category:"Food"}],
    ],
  },
  {
    ...common, id: "london", city: "London", country: "United Kingdom", airportCode: "LON", airportLabel: "London (LON) — multiple airports",
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1400&q=88",
    summary: "A varied city break with museums, markets, theatre, parks and excellent public transport.",
    bestFor: ["Museums", "Theatre", "Neighbourhoods and food"], styles: ["city", "food", "culture", "family"], costLevel: 4, suggestedNights: [3, 6], goodMonths: [4,5,6,7,8,9],
    highlights: ["South Bank", "West End", "Borough Market"],
    itinerary: [
      [{title:"South Bank walk",description:"Explore the riverfront and choose a museum or viewpoint.",category:"Sightseeing"},{title:"Market lunch",description:"Check the market's operating days and times.",category:"Food"},{title:"West End evening",description:"Check performance schedules and ticket terms.",category:"Theatre"}],
      [{title:"Museum morning",description:"Many museums have free general admission but special exhibitions may charge.",category:"Culture"},{title:"Park break",description:"Choose a park that fits the day's route.",category:"Leisure"},{title:"Neighbourhood dinner",description:"Explore a restaurant area near a Tube connection.",category:"Food"}],
      [{title:"Historic landmark",description:"Choose one major attraction and confirm ticket availability.",category:"History"},{title:"Free afternoon",description:"Keep time for shopping or an unplanned stop.",category:"Leisure"},{title:"Departure preparation",description:"Check airport and rail service information before travelling.",category:"Transport"}],
    ],
  },
  {
    ...common, id: "tokyo", city: "Tokyo", country: "Japan", airportCode: "TYO", airportLabel: "Tokyo (TYO) — Haneda / Narita",
    image: "https://images.unsplash.com/photo-1540959733332-eab4deffee7e?auto=format&fit=crop&w=1400&q=88",
    summary: "A high-energy but highly varied city experience spanning food, design, neighbourhoods and day trips.",
    bestFor: ["Food", "Culture", "Shopping and design"], styles: ["city", "food", "culture", "family", "adventure"], costLevel: 3, suggestedNights: [5, 9], goodMonths: [3,4,5,10,11],
    highlights: ["Asakusa and Ueno", "Shibuya and Shinjuku", "Tsukiji outer market area"],
    itinerary: [
      [{title:"Asakusa orientation",description:"Explore the historic area and nearby streets.",category:"Culture"},{title:"Ueno park area",description:"Choose a museum or park visit based on the day.",category:"Culture"},{title:"Easy local dinner",description:"Stay close to your accommodation after the first long day.",category:"Food"}],
      [{title:"Shibuya and Harajuku",description:"Combine neighbourhoods while allowing time for crowds and transit.",category:"Neighbourhood"},{title:"Meiji Shrine area",description:"Respect site guidance and quiet areas.",category:"Culture"},{title:"Shinjuku evening",description:"Check age restrictions and venue policies where relevant.",category:"Nightlife"}],
      [{title:"Food and market exploration",description:"Check market hours and choose a few stops rather than trying everything.",category:"Food"},{title:"Flexible afternoon",description:"Leave room for shopping or rest.",category:"Leisure"},{title:"Dinner reservation",description:"Popular restaurants may need advance reservations.",category:"Food"}],
    ],
  },
  {
    ...common, id: "reykjavik", city: "Reykjavík", country: "Iceland", airportCode: "KEF", airportLabel: "Keflavík International (KEF)",
    image: "https://images.unsplash.com/photo-1476610182048-b716b8518aae?auto=format&fit=crop&w=1400&q=88",
    summary: "A nature-oriented base for geothermal bathing, dramatic landscapes and guided day trips.",
    bestFor: ["Nature", "Scenic drives", "Hot springs"], styles: ["nature", "adventure", "romantic"], costLevel: 4, suggestedNights: [3, 6], goodMonths: [2,3,6,7,8,9,10,11],
    highlights: ["Reykjavík centre", "Golden Circle", "Geothermal bathing"],
    itinerary: [
      [{title:"Reykjavík centre",description:"Explore the harbour and central streets on foot.",category:"City"},{title:"Local food stop",description:"Check opening hours and book ahead where needed.",category:"Food"},{title:"Geothermal experience",description:"Review booking, transport and bathing rules.",category:"Wellness"}],
      [{title:"Golden Circle guided day",description:"Compare route length, pickup point and weather policy.",category:"Nature"},{title:"Scenic stops",description:"Follow guide instructions and stay within marked visitor areas.",category:"Nature"},{title:"Return and rest",description:"Allow for a full day away from the city.",category:"Leisure"}],
      [{title:"Choose a second nature outing",description:"Select according to season, road conditions and daylight.",category:"Adventure"},{title:"Flexible city time",description:"Keep time for a museum or café.",category:"Culture"},{title:"Departure preparation",description:"Confirm airport transfer and check-in times.",category:"Transport"}],
    ],
  },
  {
    ...common, id: "aruba", city: "Aruba", country: "Aruba", airportCode: "AUA", airportLabel: "Queen Beatrix International (AUA)",
    image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1400&q=88",
    summary: "A warm-weather island break with beaches, low-key resort days and outdoor excursions.",
    bestFor: ["Beach", "Couples", "Relaxed island touring"], styles: ["beach", "romantic", "family", "adventure"], costLevel: 4, suggestedNights: [4, 7], goodMonths: [1,2,3,4,5,6,12],
    highlights: ["Eagle Beach", "Oranjestad", "Arikok National Park"],
    itinerary: [
      [{title:"Settle in and explore the coast",description:"Check beach access and your resort's amenities.",category:"Beach"},{title:"Oranjestad stroll",description:"Explore the waterfront and central area.",category:"City"},{title:"Dinner near your stay",description:"Consider transport options before booking.",category:"Food"}],
      [{title:"Beach morning",description:"Choose a beach based on facilities and conditions.",category:"Beach"},{title:"Island tour",description:"Compare licensed operators and vehicle requirements.",category:"Adventure"},{title:"Relaxed evening",description:"Keep the evening open.",category:"Leisure"}],
      [{title:"Arikok National Park",description:"Check access rules, road conditions and guide requirements.",category:"Nature"},{title:"Return for downtime",description:"Leave a buffer after outdoor activities.",category:"Leisure"},{title:"Final dinner",description:"Reserve popular places ahead of time.",category:"Food"}],
    ],
  },
  {
    ...common, id: "vancouver", city: "Vancouver", country: "Canada", airportCode: "YVR", airportLabel: "Vancouver International (YVR)",
    image: "https://images.unsplash.com/photo-1559511260-66a654ae982a?auto=format&fit=crop&w=1400&q=88",
    summary: "A city-and-outdoors combination with waterfront paths, neighbourhood food and mountain views.",
    bestFor: ["Outdoor access", "Food", "City and scenery"], styles: ["nature", "city", "food", "adventure"], costLevel: 4, suggestedNights: [3, 6], goodMonths: [5,6,7,8,9],
    highlights: ["Stanley Park", "Granville Island", "North Shore"],
    itinerary: [
      [{title:"Waterfront and downtown",description:"Get oriented around the harbour and central neighbourhoods.",category:"City"},{title:"Granville Island",description:"Check market hours and transit options.",category:"Food"},{title:"Dinner in a local neighbourhood",description:"Pick a place near your accommodation.",category:"Food"}],
      [{title:"Stanley Park",description:"Choose a walk or cycle route suited to your pace.",category:"Nature"},{title:"Free afternoon",description:"Leave time to rest or explore the waterfront.",category:"Leisure"},{title:"Evening dining",description:"Check reservations and transport.",category:"Food"}],
      [{title:"North Shore outing",description:"Check transit, trail conditions and seasonal operations.",category:"Nature"},{title:"Return to the city",description:"Allow time for transit connections.",category:"Transport"},{title:"Departure preparation",description:"Confirm airport transfer and check-in timing.",category:"Transport"}],
    ],
  },
  {
    ...common, id: "montreal", city: "Montréal", country: "Canada", airportCode: "YUL", airportLabel: "Montréal–Trudeau (YUL)",
    image: "https://images.unsplash.com/photo-1519178614-68673b201f36?auto=format&fit=crop&w=1400&q=88",
    summary: "A compact culture and food escape with historic streets, festivals and distinct neighbourhoods.",
    bestFor: ["Food", "Culture", "Weekend escapes"], styles: ["city", "food", "culture", "romantic"], costLevel: 3, suggestedNights: [2, 5], goodMonths: [5,6,7,8,9,10,12],
    highlights: ["Old Montréal", "Plateau and Mile End", "Mount Royal"],
    itinerary: [
      [{title:"Old Montréal",description:"Explore the historic streets and waterfront.",category:"History"},{title:"Café and local lunch",description:"Choose a stop near your walking route.",category:"Food"},{title:"Evening in the Old Port",description:"Check seasonal activities and opening times.",category:"Leisure"}],
      [{title:"Mount Royal",description:"Choose a route and check conditions for the season.",category:"Nature"},{title:"Mile End",description:"Explore cafés, shops and neighbourhood streets.",category:"Neighbourhood"},{title:"Dinner reservation",description:"Try a local restaurant and check menus in advance.",category:"Food"}],
      [{title:"Museum or market",description:"Pick one indoor option in case of weather changes.",category:"Culture"},{title:"Free time",description:"Leave room for a slower finish.",category:"Leisure"},{title:"Departure preparation",description:"Confirm airport transport.",category:"Transport"}],
    ],
  },
];

export function normalizeDestinationQuery(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function findDestination(value: string): Destination | undefined {
  const query = normalizeDestinationQuery(value);
  if (!query || ["anywhere", "surprise me", "no preference", "open to ideas"].includes(query)) return undefined;
  return DESTINATIONS.find((item) => {
    const full = normalizeDestinationQuery(`${item.city} ${item.country}`);
    return query === normalizeDestinationQuery(item.city) || query === normalizeDestinationQuery(item.country) || query === full || query === item.id || query === item.airportCode.toLowerCase();
  });
}

export function styleLabel(style: TripStyle): string {
  const labels: Record<TripStyle, string> = {
    any: "A little bit of everything", beach: "Beach and slow days", city: "City exploration", food: "Food and local culture",
    nature: "Nature and scenery", romantic: "Romantic escape", family: "Family-friendly", adventure: "Adventure", culture: "History and culture",
  };
  return labels[style];
}
