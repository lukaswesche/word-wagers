#!/usr/bin/env node
/**
 * Builds the mini-game category corpus from dariusk/corpora and a few inlined
 * lists. Writes a single JSON bundle to data/mg-categories.json.
 *
 * Each source declares:
 *   id, short, prompt, url, extract(json) -> string[]
 *
 * Output shape (matches what server/src/minigame.ts and client expect):
 *   [{ id, short, prompt, answers: (string | string[])[] }, ...]
 *
 * Run:  node scripts/fetch-categories.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_PATHS = [
  path.join(REPO_ROOT, 'data', 'mg-categories.json'),
  path.join(REPO_ROOT, 'client', 'src', 'minigame', 'data', 'mg-categories.json'),
];

const CORPORA = (file) =>
  `https://raw.githubusercontent.com/dariusk/corpora/master/data/${file}`;

// pick(obj, key) — returns obj[key] if array, else first array value in obj
const pickArray = (obj, key) => {
  if (key && Array.isArray(obj[key])) return obj[key];
  for (const k of Object.keys(obj)) if (Array.isArray(obj[k])) return obj[k];
  return [];
};

// Map an array of strings or objects -> strings via field name or identity
const fields = (arr, ...fieldNames) =>
  arr
    .map((x) => {
      if (typeof x === 'string') return x;
      for (const f of fieldNames) {
        if (x && typeof x[f] === 'string') return x[f];
      }
      return null;
    })
    .filter(Boolean);

const SOURCES = [
  // ── sports ──
  {
    id: 'nba_teams',
    short: 'NBA teams',
    prompt: 'Name as many NBA teams as you can.',
    url: CORPORA('sports/nba_teams.json'),
    extract: (j) => fields(pickArray(j, 'nba_teams'), 'team', 'name'),
    aliasShort: true, // also accept just the team-name part after city
  },
  {
    id: 'nfl_teams',
    short: 'NFL teams',
    prompt: 'Name as many NFL teams as you can.',
    url: CORPORA('sports/nfl_teams.json'),
    extract: (j) => fields(pickArray(j, 'nfl_teams'), 'team', 'name'),
    aliasShort: true,
  },
  {
    id: 'mlb_teams',
    short: 'MLB teams',
    prompt: 'Name as many MLB teams as you can.',
    url: CORPORA('sports/mlb_teams.json'),
    extract: (j) => fields(pickArray(j, 'mlb_teams'), 'team', 'name'),
    aliasShort: true,
  },
  {
    id: 'nhl_teams',
    short: 'NHL teams',
    prompt: 'Name as many NHL teams as you can.',
    url: CORPORA('sports/nhl_teams.json'),
    extract: (j) => fields(pickArray(j, 'nhl_teams'), 'team', 'name'),
    aliasShort: true,
  },
  {
    id: 'nba_mvps',
    short: 'NBA MVPs',
    prompt: 'Name as many NBA MVP winners as you can.',
    url: CORPORA('sports/nba_mvps.json'),
    extract: (j) => {
      const w = j?.winners;
      if (!w || typeof w !== 'object') return [];
      return Object.values(w).map(v => v?.name).filter(Boolean);
    },
  },

  // ── film + tv ──
  {
    id: 'popular_movies',
    short: 'Famous films (any era)',
    prompt: 'Name as many famous or classic films as you can — any genre or decade counts.',
    url: CORPORA('film-tv/popular-movies.json'),
    extract: (j) => fields(pickArray(j, 'popular-movies', 'movies'), 'title', 'name'),
  },
  {
    id: 'tv_shows',
    short: 'Famous TV shows',
    prompt: 'Name as many famous TV shows as you can — any genre or era counts.',
    url: CORPORA('film-tv/tv_shows.json'),
    extract: (j) => fields(pickArray(j, 'tv_shows', 'shows'), 'title', 'name'),
  },
  {
    id: 'got_houses',
    short: 'Game of Thrones houses',
    prompt: 'Name as many Game of Thrones houses as you can.',
    url: CORPORA('film-tv/game-of-thrones-houses.json'),
    extract: (j) => fields(pickArray(j, 'houses'), 'name'),
  },

  // ── games ──
  {
    id: 'pokemon',
    short: 'Pokémon',
    prompt: 'Name as many Pokémon as you can.',
    url: CORPORA('games/pokemon.json'),
    extract: (j) => fields(pickArray(j, 'pokemon'), 'name'),
  },
  {
    id: 'street_fighter',
    short: 'Street Fighter characters',
    prompt: 'Name as many Street Fighter II characters as you can.',
    url: CORPORA('games/street_fighter_ii.json'),
    extract: (j) => fields(pickArray(j, 'characters'), 'character', 'name'),
  },
  {
    id: 'board_games',
    short: 'Board games',
    prompt: 'Name any board games you can think of.',
    url: CORPORA('games/board_games.json'),
    extract: (j) => fields(pickArray(j, 'board_games', 'games'), 'name', 'title'),
  },
  {
    id: 'wrestling_moves',
    short: 'Wrestling moves',
    prompt: 'Name as many pro wrestling moves as you can.',
    url: CORPORA('games/wrestling_moves.json'),
    extract: (j) => fields(pickArray(j, 'moves'), 'name'),
  },

  // ── music ──
  {
    id: 'music_genres',
    short: 'Music genres',
    prompt: 'Name as many music genres as you can.',
    url: CORPORA('music/genres.json'),
    extract: (j) => fields(pickArray(j, 'genres'), 'name'),
  },
  {
    id: 'instruments',
    short: 'Musical instruments',
    prompt: 'Name as many musical instruments as you can.',
    url: CORPORA('music/instruments.json'),
    extract: (j) => fields(pickArray(j, 'instruments'), 'name'),
  },
  {
    id: 'rock_hof',
    short: 'Rock & Roll Hall of Fame',
    prompt: 'Name as many Rock & Roll Hall of Fame inductees as you can.',
    url: CORPORA('music/rock_hall_of_fame.json'),
    extract: (j) => fields(pickArray(j, 'inductees'), 'name'),
  },
  {
    id: 'xxl_freshman',
    short: 'XXL Freshman class',
    prompt: 'Name as many XXL Freshman class rappers as you can.',
    url: CORPORA('music/xxl_freshman.json'),
    extract: (j) => {
      const arr = pickArray(j, 'xxl_freshman', 'rappers', 'artists');
      // file shape: [{year, freshmen: [...]}] in some, or flat list
      const out = [];
      for (const x of arr) {
        if (typeof x === 'string') out.push(x);
        else if (Array.isArray(x?.freshmen)) out.push(...x.freshmen);
        else if (typeof x?.name === 'string') out.push(x.name);
      }
      return out;
    },
  },

  // ── geography ──
  {
    id: 'countries',
    short: 'Countries',
    prompt: 'Name as many countries as you can.',
    url: CORPORA('geography/countries.json'),
    extract: (j) => fields(pickArray(j, 'countries'), 'name'),
  },
  {
    id: 'us_state_capitals',
    short: 'US state capitals',
    prompt: 'Name as many US state capitals as you can.',
    url: CORPORA('geography/us_state_capitals.json'),
    extract: (j) => fields(pickArray(j, 'us_state_capitals', 'capitals'), 'capital', 'name'),
  },
  {
    id: 'rivers',
    short: 'Major rivers',
    prompt: 'Name as many famous rivers as you can.',
    url: CORPORA('geography/rivers.json'),
    extract: (j) => fields(pickArray(j, 'rivers'), 'name'),
  },

  // ── mythology ──
  {
    id: 'greek_gods',
    short: 'Greek gods',
    prompt: 'Name as many Greek gods as you can.',
    url: CORPORA('mythology/greek_gods.json'),
    extract: (j) => fields(pickArray(j, 'greek_gods', 'gods'), 'name'),
  },
  {
    id: 'norse_gods',
    short: 'Norse gods',
    prompt: 'Name as many Norse gods as you can.',
    url: CORPORA('mythology/norse_gods.json'),
    extract: (j) => {
      const nd = j?.norse_deities ?? {};
      const out = [];
      for (const k of Object.keys(nd)) {
        if (Array.isArray(nd[k])) out.push(...nd[k]);
      }
      return out;
    },
  },
  {
    id: 'greek_monsters',
    short: 'Greek mythological monsters',
    prompt: 'Name as many monsters from Greek mythology as you can.',
    url: CORPORA('mythology/greek_monsters.json'),
    extract: (j) => fields(pickArray(j, 'monsters'), 'name'),
  },

  // ── humans / pop culture ──
  {
    id: 'oceans_and_seas',
    short: 'Oceans & seas',
    prompt: 'Name as many oceans and major seas as you can.',
    url: CORPORA('geography/oceans.json'),
    extract: (j) => {
      const oc = fields(pickArray(j, 'oceans'), 'name');
      const seas = fields(pickArray(j, 'seas'), 'name');
      return [...oc, ...seas];
    },
  },
  {
    id: 'celebrities',
    short: 'Celebrities',
    prompt: 'Name any celebrities you can think of.',
    url: CORPORA('humans/celebrities.json'),
    extract: (j) => fields(pickArray(j, 'celebrities'), 'name'),
  },
  {
    id: 'authors',
    short: 'Famous authors',
    prompt: 'Name as many famous authors as you can.',
    url: CORPORA('humans/authors.json'),
    extract: (j) => fields(pickArray(j, 'authors'), 'name'),
  },
  {
    id: 'wrestlers',
    short: 'Pro wrestlers',
    prompt: 'Name as many pro wrestlers as you can.',
    url: CORPORA('humans/wrestlers.json'),
    extract: (j) => fields(pickArray(j, 'wrestlers'), 'name'),
  },

  // ── foods ──
  {
    id: 'cocktails',
    short: 'IBA cocktails',
    prompt: 'Name as many cocktails as you can.',
    url: CORPORA('foods/iba_cocktails.json'),
    extract: (j) => fields(pickArray(j, 'cocktails'), 'name'),
  },
  {
    id: 'pizza_toppings',
    short: 'Pizza toppings',
    prompt: 'Name as many pizza toppings as you can.',
    url: CORPORA('foods/pizzaToppings.json'),
    extract: (j) => fields(pickArray(j, 'pizzaToppings', 'toppings'), 'name'),
  },
  {
    id: 'fruits',
    short: 'Fruits',
    prompt: 'Name as many fruits as you can.',
    url: CORPORA('foods/fruits.json'),
    extract: (j) => fields(pickArray(j, 'fruits'), 'name'),
  },
  {
    id: 'vegetables',
    short: 'Vegetables',
    prompt: 'Name as many vegetables as you can.',
    url: CORPORA('foods/vegetables.json'),
    extract: (j) => fields(pickArray(j, 'vegetables'), 'name'),
  },
  {
    id: 'beer_styles',
    short: 'Beer styles',
    prompt: 'Name as many beer styles as you can.',
    url: CORPORA('foods/beer_styles.json'),
    extract: (j) => fields(pickArray(j, 'beer_styles', 'styles'), 'name'),
  },

  // ── animals + science ──
  {
    id: 'dinosaurs',
    short: 'Dinosaurs',
    prompt: 'Name as many dinosaurs as you can.',
    url: CORPORA('animals/dinosaurs.json'),
    extract: (j) => fields(pickArray(j, 'dinosaurs'), 'name'),
  },
  {
    id: 'dog_breeds',
    short: 'Dog breeds',
    prompt: 'Name as many dog breeds as you can.',
    url: CORPORA('animals/dogs.json'),
    extract: (j) => fields(pickArray(j, 'dogs', 'breeds'), 'name'),
  },
  {
    id: 'cats',
    short: 'Cat breeds',
    prompt: 'Name as many cat breeds as you can.',
    url: CORPORA('animals/cats.json'),
    extract: (j) => fields(pickArray(j, 'cats', 'breeds'), 'name'),
  },
];

// ── hand-curated extras (no upstream needed) ──
const INLINE = [
  // ── geography / civics ──
  {
    id: 'us_states',
    short: 'US states',
    prompt: 'How many US states can you name?',
    answers: [
      'Alabama','Alaska','Arizona','Arkansas','California','Colorado',
      'Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho',
      'Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
      'Maine','Maryland','Massachusetts','Michigan','Minnesota',
      'Mississippi','Missouri','Montana','Nebraska','Nevada',
      'New Hampshire','New Jersey','New Mexico','New York',
      'North Carolina','North Dakota','Ohio','Oklahoma','Oregon',
      'Pennsylvania','Rhode Island','South Carolina','South Dakota',
      'Tennessee','Texas','Utah','Vermont','Virginia','Washington',
      'West Virginia','Wisconsin','Wyoming',
    ],
  },
  {
    id: 'planets',
    short: 'Planets & dwarf planets',
    prompt: 'Name planets and dwarf planets of our solar system.',
    answers: [
      'Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus',
      'Neptune','Pluto','Ceres','Eris','Haumea','Makemake',
    ],
  },
  {
    id: 'us_presidents',
    short: 'US presidents',
    prompt: 'Name as many US presidents as you can.',
    answers: [
      'George Washington','John Adams','Thomas Jefferson','James Madison','James Monroe',
      'John Quincy Adams','Andrew Jackson','Martin Van Buren','William Henry Harrison',
      'John Tyler','James K Polk','Zachary Taylor','Millard Fillmore','Franklin Pierce',
      'James Buchanan','Abraham Lincoln','Andrew Johnson','Ulysses S Grant',
      'Rutherford B Hayes','James A Garfield','Chester A Arthur','Grover Cleveland',
      'Benjamin Harrison','William McKinley','Theodore Roosevelt','William Howard Taft',
      'Woodrow Wilson','Warren G Harding','Calvin Coolidge','Herbert Hoover',
      'Franklin D Roosevelt','Harry S Truman','Dwight D Eisenhower','John F Kennedy',
      'Lyndon B Johnson','Richard Nixon','Gerald Ford','Jimmy Carter','Ronald Reagan',
      'George H W Bush','Bill Clinton','George W Bush','Barack Obama','Donald Trump',
      'Joe Biden',
    ],
  },
  {
    id: 'olympic_sports',
    short: 'Olympic sports',
    prompt: 'Name as many Summer Olympic sports as you can.',
    answers: [
      'Archery','Artistic Swimming','Athletics','Badminton','Baseball','Softball',
      'Basketball','3x3 Basketball','Beach Volleyball','Boxing','Breaking',
      'Canoeing','Cycling','Diving','Equestrian','Fencing','Field Hockey',
      'Football','Golf','Gymnastics','Handball','Judo','Karate','Marathon Swimming',
      'Modern Pentathlon','Rowing','Rugby','Rugby Sevens','Sailing','Shooting',
      'Skateboarding','Sport Climbing','Surfing','Swimming','Table Tennis',
      'Taekwondo','Tennis','Trampoline','Triathlon','Volleyball','Water Polo',
      'Weightlifting','Wrestling',
    ],
  },
  {
    id: 'eu_countries',
    short: 'EU member states',
    prompt: 'Name as many European Union member states as you can.',
    answers: [
      'Austria','Belgium','Bulgaria','Croatia','Cyprus','Czech Republic',
      'Denmark','Estonia','Finland','France','Germany','Greece',
      'Hungary','Ireland','Italy','Latvia','Lithuania','Luxembourg',
      'Malta','Netherlands','Poland','Portugal','Romania','Slovakia',
      'Slovenia','Spain','Sweden',
    ],
  },
  {
    id: 'world_capitals',
    short: 'World capitals',
    prompt: 'Name as many world capital cities as you can.',
    answers: [
      'Washington DC','London','Paris','Berlin','Tokyo','Beijing','Moscow','Ottawa',
      'Canberra','Rome','Madrid','Lisbon','Amsterdam','Brussels','Vienna','Bern',
      'Stockholm','Oslo','Copenhagen','Helsinki','Dublin','Athens','Warsaw','Prague',
      'Budapest','Bucharest','Sofia','Kyiv','Minsk','Sarajevo','Belgrade','Zagreb',
      'Ankara','Cairo','Nairobi','Addis Ababa','Accra','Lagos','Abuja','Kinshasa',
      'Johannesburg','Cape Town','Pretoria','Rabat','Algiers','Tunis','Tripoli',
      'New Delhi','Mumbai','Islamabad','Kabul','Tehran','Baghdad','Riyadh','Doha',
      'Abu Dhabi','Kuwait City','Amman','Beirut','Jerusalem','Damascus','Kathmandu',
      'Dhaka','Colombo','Yangon','Bangkok','Kuala Lumpur','Jakarta','Manila',
      'Hanoi','Ho Chi Minh City','Seoul','Pyongyang','Taipei','Singapore',
      'Mexico City','Buenos Aires','Santiago','Lima','Bogota','Caracas','Quito',
      'Brasilia','Montevideo','Asuncion','La Paz','Sucre','Georgetown','Paramaribo',
      'Havana','Kingston','Nassau','Port-au-Prince','Santo Domingo','San Jose',
      'Panama City','Guatemala City','Tegucigalpa','Managua','San Salvador',
    ],
  },

  // ── sports: teams ──
  {
    id: 'nba_champions',
    short: 'NBA champions',
    prompt: 'Name as many NBA championship-winning teams as you can.',
    answers: [
      ['Boston Celtics','Celtics'],['Los Angeles Lakers','Lakers','LA Lakers'],
      ['Golden State Warriors','Warriors'],['Chicago Bulls','Bulls'],
      ['San Antonio Spurs','Spurs'],['Miami Heat','Heat'],
      ['Detroit Pistons','Pistons'],['Dallas Mavericks','Mavericks','Mavs'],
      ['Houston Rockets','Rockets'],['Philadelphia 76ers','76ers','Sixers'],
      ['New York Knicks','Knicks'],['Milwaukee Bucks','Bucks'],
      ['Portland Trail Blazers','Trail Blazers','Blazers'],
      ['Seattle SuperSonics','SuperSonics'],['Washington Bullets','Bullets'],
      ['Cleveland Cavaliers','Cavaliers','Cavs'],['Toronto Raptors','Raptors'],
      ['Denver Nuggets','Nuggets'],
    ],
  },
  {
    id: 'nfl_super_bowl',
    short: 'Super Bowl winners',
    prompt: 'Name as many Super Bowl-winning NFL teams as you can.',
    answers: [
      ['New England Patriots','Patriots'],['Pittsburgh Steelers','Steelers'],
      ['San Francisco 49ers','49ers'],['Dallas Cowboys','Cowboys'],
      ['Green Bay Packers','Packers'],['Denver Broncos','Broncos'],
      ['Oakland Raiders','Raiders','Las Vegas Raiders'],
      ['Washington Redskins','Redskins'],['Miami Dolphins','Dolphins'],
      ['New York Giants','Giants'],['Baltimore Ravens','Ravens'],
      ['Tampa Bay Buccaneers','Buccaneers','Bucs'],['Indianapolis Colts','Colts'],
      ['New York Jets','Jets'],['Kansas City Chiefs','Chiefs'],
      ['Los Angeles Rams','Rams','LA Rams'],['Philadelphia Eagles','Eagles'],
      ['Seattle Seahawks','Seahawks'],['New Orleans Saints','Saints'],
      ['Baltimore Colts'],['Chicago Bears','Bears'],
    ],
  },
  {
    id: 'mlb_world_series',
    short: 'World Series winners',
    prompt: 'Name as many World Series-winning MLB teams as you can.',
    answers: [
      ['New York Yankees','Yankees'],['St. Louis Cardinals','Cardinals'],
      ['Oakland Athletics','Athletics','Oakland As'],
      ['Boston Red Sox','Red Sox'],['Los Angeles Dodgers','Dodgers'],
      ['Cincinnati Reds','Reds'],['Pittsburgh Pirates','Pirates'],
      ['Minnesota Twins','Twins'],['Atlanta Braves','Braves'],
      ['Toronto Blue Jays','Blue Jays'],['Florida Marlins','Marlins','Miami Marlins'],
      ['Arizona Diamondbacks','Diamondbacks','D-backs'],
      ['Anaheim Angels','Angels','Los Angeles Angels'],
      ['Chicago White Sox','White Sox'],['Chicago Cubs','Cubs'],
      ['Houston Astros','Astros'],['Washington Nationals','Nationals'],
      ['Atlanta Braves','Braves'],['Texas Rangers','Rangers'],
    ],
  },
  {
    id: 'premier_league_clubs',
    short: 'Premier League clubs',
    prompt: 'Name as many current or former Premier League clubs as you can.',
    answers: [
      ['Manchester United','Man United','Man Utd'],
      ['Manchester City','Man City'],
      ['Arsenal'],['Chelsea'],['Liverpool'],['Tottenham Hotspur','Tottenham','Spurs'],
      ['Everton'],['Aston Villa'],['Newcastle United','Newcastle'],
      ['West Ham United','West Ham'],['Leicester City','Leicester'],
      ['Leeds United','Leeds'],['Wolverhampton Wanderers','Wolves'],
      ['Nottingham Forest','Forest'],['Southampton'],['Crystal Palace'],
      ['Brighton & Hove Albion','Brighton'],['Fulham'],['Brentford'],
      ['Burnley'],['Bournemouth'],['Sheffield United'],
      ['Queens Park Rangers','QPR'],['Watford'],['Norwich City','Norwich'],
      ['Swansea City','Swansea'],['Cardiff City','Cardiff'],['Stoke City','Stoke'],
      ['Blackburn Rovers','Blackburn'],['Ipswich Town','Ipswich'],['Luton Town','Luton'],
    ],
  },
  {
    id: 'ucl_winners',
    short: 'UEFA Champions League winners',
    prompt: 'Name as many UEFA Champions League winners as you can.',
    answers: [
      ['Real Madrid','Real'],['AC Milan','Milan'],['Bayern Munich','Bayern'],
      ['Liverpool'],['Barcelona','Barca'],['Ajax'],['Juventus'],
      ['Benfica'],['Inter Milan','Inter','Internazionale'],
      ['Manchester United','Man United'],['Borussia Dortmund','Dortmund'],
      ['Marseille'],['PSV Eindhoven','PSV'],['Steaua Bucharest'],
      ['Porto'],['Nottingham Forest','Forest'],['Aston Villa'],
      ['Chelsea'],['Manchester City','Man City'],
    ],
  },
  {
    id: 'fifa_world_cup',
    short: 'FIFA World Cup winners',
    prompt: 'Name as many FIFA World Cup winning countries as you can.',
    answers: [
      'Brazil','Germany','Italy','Argentina','France','Uruguay',
      'England','Spain',
    ],
  },
  {
    id: 'grand_slam_winners',
    short: 'Grand Slam tennis winners',
    prompt: 'Name as many Grand Slam tennis tournament winners as you can.',
    answers: [
      ['Novak Djokovic','Djokovic'],['Rafael Nadal','Nadal'],
      ['Roger Federer','Federer'],['Pete Sampras','Sampras'],
      ['Jimmy Connors','Connors'],['Ivan Lendl','Lendl'],
      ['John McEnroe','McEnroe'],['Bjorn Borg','Borg'],
      ['Serena Williams','Serena'],['Steffi Graf','Graf'],
      ['Martina Navratilova','Navratilova'],['Chris Evert','Evert'],
      ['Venus Williams'],['Maria Sharapova','Sharapova'],
      ['Monica Seles','Seles'],['Andre Agassi','Agassi'],
      ['Carlos Alcaraz','Alcaraz'],['Jannik Sinner','Sinner'],
      ['Coco Gauff','Gauff'],['Naomi Osaka','Osaka'],
      ['Iga Swiatek','Swiatek'],['Andy Murray','Murray'],
    ],
  },
  {
    id: 'nfl_quarterbacks',
    short: 'NFL quarterbacks',
    prompt: 'Name as many famous NFL quarterbacks as you can.',
    answers: [
      'Tom Brady','Patrick Mahomes','Peyton Manning','Joe Montana','Aaron Rodgers',
      'Brett Favre','Drew Brees','John Elway','Dan Marino','Terry Bradshaw',
      'Roger Staubach','Troy Aikman','Steve Young','Jim Kelly','Fran Tarkenton',
      'Eli Manning','Ben Roethlisberger','Lamar Jackson','Josh Allen','Joe Burrow',
      'Jalen Hurts','Trevor Lawrence','Justin Herbert','Dak Prescott','Russell Wilson',
      'Matthew Stafford','Kirk Cousins','Ryan Tannehill','Derek Carr',
      'Johnny Unitas','Bart Starr','Otto Graham','Sammy Baugh','Len Dawson',
    ],
  },
  {
    id: 'nba_players',
    short: 'NBA players',
    prompt: 'Name as many famous NBA players as you can.',
    answers: [
      'LeBron James','Michael Jordan','Kobe Bryant','Kareem Abdul-Jabbar','Bill Russell',
      'Magic Johnson','Larry Bird','Wilt Chamberlain','Shaquille ONeal','Tim Duncan',
      'Stephen Curry','Kevin Durant','Giannis Antetokounmpo','Charles Barkley',
      'Karl Malone','John Stockton','Hakeem Olajuwon','Patrick Ewing','Isiah Thomas',
      'Scottie Pippen','Dennis Rodman','Dirk Nowitzki','Dwyane Wade','Allen Iverson',
      'Paul Pierce','Ray Allen','Kevin Garnett','Chris Paul','James Harden',
      'Russell Westbrook','Kawhi Leonard','Nikola Jokic','Joel Embiid','Luka Doncic',
      'Jayson Tatum','Anthony Davis','Damian Lillard','Devin Booker','Trae Young',
      'Ja Morant','Zion Williamson','Cade Cunningham','Victor Wembanyama',
    ],
  },
  {
    id: 'soccer_players',
    short: 'Soccer/football stars',
    prompt: 'Name as many famous soccer players as you can.',
    answers: [
      'Lionel Messi','Cristiano Ronaldo','Pele','Diego Maradona','Zinedine Zidane',
      'Ronaldo Fenomeno','Ronaldinho','Johan Cruyff','Franz Beckenbauer','Michel Platini',
      'Eusebio','George Best','Bobby Charlton','Gary Lineker','Alan Shearer',
      'Thierry Henry','Didier Drogba','Wayne Rooney','David Beckham','Patrick Vieira',
      'Frank Lampard','Steven Gerrard','Paul Scholes','Ryan Giggs','Roy Keane',
      'Kylian Mbappe','Neymar','Vinicius Junior','Erling Haaland','Mohamed Salah',
      'Robert Lewandowski','Kevin De Bruyne','Son Heung-min','Harry Kane',
      'Luka Modric','Toni Kroos','Sergio Ramos','Gerard Pique','Virgil van Dijk',
    ],
  },
  {
    id: 'golf_majors',
    short: 'Golf major winners',
    prompt: 'Name as many golf major tournament winners as you can.',
    answers: [
      'Tiger Woods','Jack Nicklaus','Arnold Palmer','Gary Player','Ben Hogan',
      'Sam Snead','Byron Nelson','Walter Hagen','Bobby Jones','Gene Sarazen',
      'Rory McIlroy','Phil Mickelson','Jordan Spieth','Dustin Johnson','Brooks Koepka',
      'Jon Rahm','Scottie Scheffler','Viktor Hovland','Collin Morikawa',
      'Justin Thomas','Xander Schauffele','Bryson DeChambeau','Patrick Cantlay',
      'Tom Watson','Lee Trevino','Nick Faldo','Seve Ballesteros','Greg Norman',
      'Ernie Els','Vijay Singh','Padraig Harrington',
    ],
  },
  {
    id: 'boxing_champions',
    short: 'Boxing champions',
    prompt: 'Name as many famous boxing world champions as you can.',
    answers: [
      'Muhammad Ali','Mike Tyson','Floyd Mayweather','Joe Louis','Sugar Ray Robinson',
      'Rocky Marciano','Joe Frazier','George Foreman','Evander Holyfield','Lennox Lewis',
      'Oscar De La Hoya','Manny Pacquiao','Sugar Ray Leonard','Marvin Hagler',
      'Thomas Hearns','Roberto Duran','Carlos Monzon','Salvador Sanchez',
      'Julio Cesar Chavez','Erik Morales','Marco Antonio Barrera','Marco Antonio Barrera',
      'Anthony Joshua','Canelo Alvarez','Gervonta Davis','Ryan Garcia',
      'Terence Crawford','Errol Spence','Tyson Fury','Oleksandr Usyk',
      'Deontay Wilder','Andy Ruiz',
    ],
  },
  {
    id: 'formula1_drivers',
    short: 'Formula 1 world champions',
    prompt: 'Name as many Formula 1 world champion drivers as you can.',
    answers: [
      'Lewis Hamilton','Michael Schumacher','Ayrton Senna','Alain Prost','Niki Lauda',
      'Jackie Stewart','Jim Clark','Jack Brabham','Juan Manuel Fangio',
      'Nelson Piquet','Nigel Mansell','Damon Hill','Mika Hakkinen',
      'Fernando Alonso','Kimi Raikkonen','Jenson Button','Sebastian Vettel',
      'Max Verstappen',
    ],
  },

  // ── films & tv ──
  {
    id: 'pixar',
    short: 'Pixar movies',
    prompt: 'How many Pixar feature films can you name?',
    answers: [
      'Toy Story', ['Toy Story 2'], ['Toy Story 3'], ['Toy Story 4'],
      "A Bug's Life", 'Monsters Inc', 'Monsters University',
      'Finding Nemo', 'Finding Dory',
      ['The Incredibles', 'Incredibles'], ['Incredibles 2'],
      'Cars', 'Cars 2', 'Cars 3', 'Ratatouille',
      ['Wall-E', 'Wall E'], 'Up', 'Brave', 'Inside Out',
      ['Inside Out 2'], 'The Good Dinosaur', 'Coco', 'Onward',
      'Soul', 'Luca', 'Turning Red', 'Lightyear', 'Elemental',
    ],
  },
  {
    id: 'mcu_films',
    short: 'MCU films',
    prompt: 'Name as many Marvel Cinematic Universe films as you can.',
    answers: [
      'Iron Man', 'The Incredible Hulk', 'Iron Man 2', 'Thor',
      'Captain America The First Avenger', 'The Avengers',
      'Iron Man 3', 'Thor The Dark World', 'Captain America The Winter Soldier',
      'Guardians of the Galaxy', 'Avengers Age of Ultron', 'Ant-Man',
      'Captain America Civil War', 'Doctor Strange',
      'Guardians of the Galaxy Vol 2', 'Spider-Man Homecoming',
      'Thor Ragnarok', 'Black Panther', 'Avengers Infinity War',
      'Ant-Man and the Wasp', 'Captain Marvel', 'Avengers Endgame',
      'Spider-Man Far From Home', 'Black Widow', 'Shang-Chi',
      'Eternals', 'Spider-Man No Way Home',
      'Doctor Strange in the Multiverse of Madness',
      'Thor Love and Thunder', 'Black Panther Wakanda Forever',
      'Ant-Man and the Wasp Quantumania', 'Guardians of the Galaxy Vol 3',
      'The Marvels', 'Deadpool & Wolverine', 'Captain America Brave New World',
      'Thunderbolts', 'Fantastic Four First Steps',
    ],
  },
  {
    id: 'star_wars_films',
    short: 'Star Wars films',
    prompt: 'Name all the live-action Star Wars films you can.',
    answers: [
      ['A New Hope','Episode IV','Star Wars IV','Star Wars'],
      ['The Empire Strikes Back','Episode V','Star Wars V'],
      ['Return of the Jedi','Episode VI','Star Wars VI'],
      ['The Phantom Menace','Episode I','Star Wars I'],
      ['Attack of the Clones','Episode II','Star Wars II'],
      ['Revenge of the Sith','Episode III','Star Wars III'],
      ['The Force Awakens','Episode VII','Star Wars VII'],
      ['The Last Jedi','Episode VIII','Star Wars VIII'],
      ['The Rise of Skywalker','Episode IX','Star Wars IX'],
      'Rogue One','Solo',
    ],
  },
  {
    id: 'oscar_best_picture',
    short: 'Oscar Best Picture winners',
    prompt: 'Name as many Academy Award Best Picture winners as you can.',
    answers: [
      'Wings','All Quiet on the Western Front','Cimarron','Grand Hotel',
      'Cavalcade','It Happened One Night','Mutiny on the Bounty','The Great Ziegfeld',
      'The Life of Emile Zola','You Can\'t Take It With You','Gone with the Wind',
      'Rebecca','How Green Was My Valley','Mrs Miniver','Casablanca',
      'Going My Way','The Lost Weekend','The Best Years of Our Lives',
      'Gentlemen\'s Agreement','Hamlet','All the King\'s Men','All About Eve',
      'An American in Paris','The Greatest Show on Earth','From Here to Eternity',
      'On the Waterfront','Marty','Around the World in 80 Days','The Bridge on the River Kwai',
      'Gigi','Ben-Hur','The Apartment','West Side Story','Lawrence of Arabia',
      'Tom Jones','My Fair Lady','The Sound of Music','A Man for All Seasons',
      'In the Heat of the Night','Oliver!','Midnight Cowboy','Patton',
      'The French Connection','The Godfather','The Sting','The Godfather Part II',
      'One Flew Over the Cuckoo\'s Nest','Rocky','Annie Hall','The Deer Hunter',
      'Kramer vs Kramer','Ordinary People','Chariots of Fire','Gandhi','Terms of Endearment',
      'Amadeus','Out of Africa','Platoon','The Last Emperor','Rain Man',
      'Driving Miss Daisy','Dances with Wolves','The Silence of the Lambs','Unforgiven',
      'Schindler\'s List','Forrest Gump','Braveheart','The English Patient',
      'Titanic','Shakespeare in Love','American Beauty','Gladiator','A Beautiful Mind',
      'Chicago','The Lord of the Rings The Return of the King','Million Dollar Baby',
      'Crash','The Departed','No Country for Old Men','Slumdog Millionaire',
      'The Hurt Locker','The King\'s Speech','The Artist','Argo','12 Years a Slave',
      'Birdman','Spotlight','Moonlight','The Shape of Water','Green Book',
      'Parasite','Nomadland','CODA','Everything Everywhere All at Once',
      'Oppenheimer','Anora',
    ],
  },
  {
    id: 'james_bond_films',
    short: 'James Bond films',
    prompt: 'Name as many James Bond films as you can.',
    answers: [
      'Dr No','From Russia with Love','Goldfinger','Thunderball',
      'You Only Live Twice','On Her Majesty\'s Secret Service',
      'Diamonds Are Forever','Live and Let Die','The Man with the Golden Gun',
      'The Spy Who Loved Me','Moonraker','For Your Eyes Only','Octopussy',
      'A View to a Kill','The Living Daylights','Licence to Kill',
      'GoldenEye','Tomorrow Never Dies','The World Is Not Enough',
      'Die Another Day','Casino Royale','Quantum of Solace','Skyfall',
      'Spectre','No Time to Die',
    ],
  },
  {
    id: 'disney_animated',
    short: 'Disney animated films',
    prompt: 'Name as many Walt Disney Animation Studios films as you can.',
    answers: [
      'Snow White and the Seven Dwarfs','Pinocchio','Fantasia','Dumbo','Bambi',
      'Cinderella','Alice in Wonderland','Peter Pan','Lady and the Tramp',
      'Sleeping Beauty','101 Dalmatians','The Sword in the Stone','The Jungle Book',
      'The Aristocats','Robin Hood','The Many Adventures of Winnie the Pooh',
      'The Rescuers','The Fox and the Hound','The Black Cauldron','The Great Mouse Detective',
      'Oliver & Company','The Little Mermaid','The Rescuers Down Under',
      'Beauty and the Beast','Aladdin','The Lion King','Pocahontas','The Hunchback of Notre Dame',
      'Hercules','Mulan','Tarzan','Fantasia 2000','Dinosaur','The Emperor\'s New Groove',
      'Atlantis The Lost Empire','Lilo & Stitch','Treasure Planet','Brother Bear',
      'Home on the Range','Chicken Little','Meet the Robinsons','Bolt',
      'The Princess and the Frog','Tangled','Winnie the Pooh','Wreck-It Ralph',
      'Frozen','Big Hero 6','Zootopia','Moana','Ralph Breaks the Internet',
      'Frozen 2','Raya and the Last Dragon','Encanto','Strange World','Wish',
      'Moana 2',
    ],
  },
  {
    id: 'harry_potter_chars',
    short: 'Harry Potter characters',
    prompt: 'Name as many Harry Potter characters as you can.',
    answers: [
      'Harry Potter','Hermione Granger','Ron Weasley','Albus Dumbledore','Severus Snape',
      'Lord Voldemort','Draco Malfoy','Sirius Black','Rubeus Hagrid','Minerva McGonagall',
      'Neville Longbottom','Luna Lovegood','Ginny Weasley','Fred Weasley','George Weasley',
      'Arthur Weasley','Molly Weasley','Bellatrix Lestrange','Lucius Malfoy','Narcissa Malfoy',
      'Peter Pettigrew','James Potter','Lily Potter','Remus Lupin','Dobby',
      'Nymphadora Tonks','Cedric Diggory','Cho Chang','Lavender Brown','Parvati Patil',
      'Dean Thomas','Seamus Finnigan','Colin Creevey','Pansy Parkinson','Blaise Zabini',
      'Viktor Krum','Fleur Delacour','Mad-Eye Moody','Dolores Umbridge','Cornelius Fudge',
      'Rufus Scrimgeour','Kingsley Shacklebolt','Professor Trelawney','Sybill Trelawney',
      'Professor Sprout','Professor Flitwick','Madam Pomfrey','Argus Filch','Nearly Headless Nick',
      'The Bloody Baron','Peeves',
    ],
  },
  {
    id: 'simpsons_chars',
    short: 'Simpsons characters',
    prompt: 'Name as many Simpsons characters as you can.',
    answers: [
      'Homer Simpson','Marge Simpson','Bart Simpson','Lisa Simpson','Maggie Simpson',
      'Ned Flanders','Moe Szyslak','Barney Gumble','Apu','Krusty the Clown',
      ['Mr Burns','Montgomery Burns'],'Waylon Smithers','Milhouse','Nelson Muntz',
      'Edna Krabappel','Principal Skinner','Superintendent Chalmers','Groundskeeper Willie',
      'Chief Wiggum','Ralph Wiggum','Sideshow Bob','Sideshow Mel',
      'Lenny Leonard','Carl Carlson','Disco Stu','Comic Book Guy',
      'Otto Mann','Hans Moleman','Patty Bouvier','Selma Bouvier',
      'Grampa Simpson','Santa\'s Little Helper','Snowball',
      'Reverend Lovejoy','Dr Hibbert','Dr Nick','Fat Tony',
    ],
  },
  {
    id: 'friends_chars',
    short: 'Friends characters',
    prompt: 'Name as many Friends characters as you can.',
    answers: [
      'Rachel Green','Monica Geller','Phoebe Buffay','Ross Geller',
      'Chandler Bing','Joey Tribbiani',
      'Gunther','Janice','Mike Hannigan','Richard Burke','Carol Willick',
      'Susan Bunch','Emily Waltham','Paolo','Barry Farber','Ursula Buffay',
      'Frank Buffay Jr','Amy Green','Sandra Green','Jack Geller','Judy Geller',
      'Ben Geller','Emma Geller',
    ],
  },
  {
    id: 'breaking_bad_chars',
    short: 'Breaking Bad characters',
    prompt: 'Name as many Breaking Bad characters as you can.',
    answers: [
      'Walter White','Jesse Pinkman','Skyler White','Hank Schrader','Marie Schrader',
      'Mike Ehrmantraut','Gustavo Fring','Saul Goodman','Walter White Jr',
      'Jane Margolis','Jane','Lydia Rodarte-Quayle','Todd Alquist','Jack Welker',
      'Tuco Salamanca','Hector Salamanca','Marco and Leonel','The Cousins',
      'Badger','Skinny Pete','Huell Babineaux','Steven Gomez',
    ],
  },
  {
    id: 'office_chars',
    short: 'The Office characters',
    prompt: 'Name as many characters from The Office (US) as you can.',
    answers: [
      'Michael Scott','Dwight Schrute','Jim Halpert','Pam Beesly','Ryan Howard',
      'Andy Bernard','Angela Martin','Kevin Malone','Oscar Martinez','Stanley Hudson',
      'Phyllis Vance','Meredith Palmer','Creed Bratton','Kelly Kapoor','Toby Flenderson',
      'Darryl Philbin','Gabe Lewis','Holly Flax','Jan Levinson','Robert California',
      'David Wallace','Roy Anderson','Charles Miner',
    ],
  },
  {
    id: 'game_of_thrones_chars',
    short: 'Game of Thrones characters',
    prompt: 'Name as many Game of Thrones characters as you can.',
    answers: [
      'Jon Snow','Daenerys Targaryen','Tyrion Lannister','Cersei Lannister','Jaime Lannister',
      'Arya Stark','Sansa Stark','Robb Stark','Bran Stark','Ned Stark',
      'Catelyn Stark','Joffrey Baratheon','Tommen Baratheon','Myrcella Baratheon',
      'Robert Baratheon','Stannis Baratheon','Renly Baratheon',
      'Margaery Tyrell','Olenna Tyrell','Loras Tyrell',
      'Littlefinger','Varys','Bronn','The Hound','The Mountain',
      'Oberyn Martell','Ellaria Sand','Jorah Mormont','Brienne of Tarth',
      'Podrick Payne','Samwell Tarly','Gilly','Hodor','Tormund Giantsbane',
      'Ygritte','Missandei','Grey Worm','Davos Seaworth','Melisandre',
      'Theon Greyjoy','Yara Greyjoy','Euron Greyjoy','Ramsay Bolton','Roose Bolton',
      'Petyr Baelish','Gendry','Hot Pie',
    ],
  },
  {
    id: 'stranger_things_chars',
    short: 'Stranger Things characters',
    prompt: 'Name as many Stranger Things characters as you can.',
    answers: [
      'Eleven','Mike Wheeler','Dustin Henderson','Lucas Sinclair','Will Byers',
      'Jim Hopper','Joyce Byers','Jonathan Byers','Nancy Wheeler','Steve Harrington',
      'Billy Hargrove','Max Mayfield','Robin Buckley','Eddie Munson',
      'Erica Sinclair','Bob Newby','Dr Brenner','The Mind Flayer','Vecna',
      'Henry Creel','Murray Bauman',
    ],
  },
  {
    id: 'fast_furious_films',
    short: 'Fast & Furious films',
    prompt: 'Name as many Fast & Furious films as you can.',
    answers: [
      'The Fast and the Furious','2 Fast 2 Furious','The Fast and the Furious Tokyo Drift',
      'Fast & Furious','Fast Five','Fast & Furious 6','Furious 7',
      'The Fate of the Furious','F9','Fast X','Hobbs & Shaw',
    ],
  },
  {
    id: 'dc_films',
    short: 'DC films',
    prompt: 'Name as many DC Comics films as you can.',
    answers: [
      'Superman','Superman II','Superman III','Superman IV',
      'Batman','Batman Returns','Batman Forever','Batman & Robin',
      'Batman Begins','The Dark Knight','The Dark Knight Rises',
      'Man of Steel','Batman v Superman','Suicide Squad','Wonder Woman',
      'Justice League','Aquaman','Shazam!','Birds of Prey','Wonder Woman 1984',
      'The Suicide Squad','Black Adam','The Flash','Blue Beetle','Aquaman and the Lost Kingdom',
      'Joker','Joker Folie a Deux',
    ],
  },
  {
    id: 'horror_films',
    short: 'Classic horror films',
    prompt: 'Name as many classic or famous horror films as you can.',
    answers: [
      'Halloween','Friday the 13th','A Nightmare on Elm Street','The Shining',
      'The Exorcist','Psycho','Jaws','Alien','Aliens',
      'Scream','I Know What You Did Last Summer','The Ring','The Grudge',
      'Paranormal Activity','Get Out','Hereditary','Midsommar','It',
      'It Chapter Two','The Conjuring','Insidious','Annabelle',
      'Sinister','The Babadook','A Quiet Place','Us','The Witch',
      'Saw','Hostel','The Hills Have Eyes','Texas Chain Saw Massacre',
      'Child\'s Play','Poltergeist','Candyman','Carrie',
      'Silence of the Lambs','The Silence of the Lambs',
      'The Blair Witch Project','Cloverfield','REC',
    ],
  },
  {
    id: 'animated_tv',
    short: 'Animated TV shows',
    prompt: 'Name as many animated TV shows as you can.',
    answers: [
      'The Simpsons','Family Guy','South Park','Bob\'s Burgers','Futurama',
      'American Dad','Archer','Rick and Morty','BoJack Horseman','Big Mouth',
      'Beavis and Butt-Head','King of the Hill','Daria','Aqua Teen Hunger Force',
      'Robot Chicken','Venture Bros','Metalocalypse','Moral Orel',
      'SpongeBob SquarePants','Avatar The Last Airbender','Teen Titans',
      'Batman The Animated Series','X-Men','Justice League','Teenage Mutant Ninja Turtles',
      'Scooby-Doo','Looney Tunes','Tom and Jerry','Bugs Bunny','Dexter\'s Laboratory',
      'The Powerpuff Girls','Johnny Bravo','Samurai Jack','Foster\'s Home for Imaginary Friends',
      'My Little Pony','Gravity Falls','Steven Universe','Adventure Time',
      'Regular Show','Clarence','We Bare Bears','Amphibia','The Owl House',
      'Bluey','Paw Patrol','Peppa Pig','SpongeBob','Rugrats',
    ],
  },
  {
    id: 'reality_tv',
    short: 'Reality TV shows',
    prompt: 'Name as many reality TV shows as you can.',
    answers: [
      'Survivor','The Amazing Race','Big Brother','American Idol','The Voice',
      'The X Factor','America\'s Got Talent','Dancing with the Stars',
      'So You Think You Can Dance','The Bachelor','The Bachelorette',
      'Love Island','Married at First Sight','90 Day Fiance','The Real Housewives',
      'Keeping Up with the Kardashians','Jersey Shore','Real World',
      'Top Chef','MasterChef','Hell\'s Kitchen','The Great British Bake Off',
      'Project Runway','Say Yes to the Dress','What Not to Wear',
      'Queer Eye','Extreme Makeover Home Edition','Fixer Upper','Flip or Flop',
      'Shark Tank','The Apprentice','Deal or No Deal',
      'Fear Factor','Jackass','Wipeout','Ninja Warrior',
      'RuPaul\'s Drag Race','Project Greenlight','Making the Band',
    ],
  },
  {
    id: 'comedy_films',
    short: 'Comedy films',
    prompt: 'Name as many classic or popular comedy films as you can.',
    answers: [
      'Dumb and Dumber','Ace Ventura','Anchorman','Step Brothers','Talladega Nights',
      'Blades of Glory','Semi-Pro','The Other Guys','Get Hard','The Campaign',
      'Wedding Crashers','The Hangover','The Hangover Part II','Project X',
      'Superbad','Knocked Up','Forgetting Sarah Marshall','Pineapple Express',
      'This Is the End','Neighbors','Bad Neighbors','Bridesmaids','Sisters',
      'The 40-Year-Old Virgin','Funny People','Trainwreck','I Feel Pretty',
      'Clueless','Mean Girls','Easy A','Pitch Perfect','Legally Blonde',
      'Groundhog Day','Liar Liar','Bruce Almighty','Evan Almighty','The Mask',
      'Home Alone','Home Alone 2','National Lampoon\'s Vacation',
      'Ferris Bueller\'s Day Off','Sixteen Candles','The Breakfast Club','Weird Science',
      'Bill & Ted\'s Excellent Adventure','Wayne\'s World','Office Space',
      'Zoolander','Dodgeball','Tropic Thunder','Bruno','Borat',
    ],
  },
  {
    id: 'action_films',
    short: 'Action films',
    prompt: 'Name as many popular action films as you can.',
    answers: [
      'Die Hard','Lethal Weapon','Beverly Hills Cop','48 Hrs','Commando',
      'Predator','Total Recall','The Terminator','Terminator 2','Terminator 3',
      'RoboCop','First Blood','Rambo','Rocky','Rocky II','Rocky III','Rocky IV',
      'Top Gun','Top Gun Maverick','Mission Impossible','Speed','Con Air','The Rock',
      'Bad Boys','Bad Boys II','Bad Boys for Life','Will Smith','Martin Lawrence',
      'John Wick','John Wick Chapter 2','John Wick Chapter 3','John Wick Chapter 4',
      'The Matrix','The Matrix Reloaded','The Matrix Revolutions','The Matrix Resurrections',
      'Heat','Collateral','Man on Fire','Enemy of the State','Spy Game',
      'True Lies','Eraser','The Last Action Hero','Kindergarten Cop','Junior',
      'Taken','Taken 2','Taken 3','96 Hours','Liam Neeson',
      'Gladiator','Braveheart','300','Troy','The Last Samurai',
    ],
  },

  // ── music ──
  {
    id: 'taylor_swift_albums',
    short: 'Taylor Swift albums',
    prompt: 'How many Taylor Swift studio albums can you name?',
    answers: [
      'Taylor Swift','Fearless','Speak Now','Red','1989','Reputation',
      'Lover','Folklore','Evermore','Midnights',
      ['The Tortured Poets Department','Tortured Poets','TTPD'],
    ],
  },
  {
    id: 'beatles_songs',
    short: 'Beatles songs',
    prompt: 'Name as many Beatles songs as you can.',
    answers: [
      'Love Me Do','Please Please Me','She Loves You','I Want to Hold Your Hand',
      'A Hard Day\'s Night','Can\'t Buy Me Love','Help!','Yesterday',
      'Let It Be','Hey Jude','Come Together','Something','Here Comes the Sun',
      'Blackbird','Eleanor Rigby','Yellow Submarine','Strawberry Fields Forever',
      'Penny Lane','Lucy in the Sky with Diamonds','Norwegian Wood','In My Life',
      'While My Guitar Gently Weeps','Back in the USSR','Ob-La-Di Ob-La-Da',
      'Get Back','Don\'t Let Me Down','The Ballad of John and Yoko',
      'Twist and Shout','Roll Over Beethoven','I Saw Her Standing There',
      'Eight Days a Week','Ticket to Ride','Michelle','Girl','Nowhere Man',
      'Drive My Car','In My Life','I Am the Walrus','Magical Mystery Tour',
    ],
  },
  // ── music: 60s ──
  {
    id: 'british_invasion_60s',
    short: '60s British Invasion bands',
    prompt: 'Name as many 60s British Invasion bands as you can.',
    answers: [
      'The Beatles','The Rolling Stones','The Who','The Kinks','The Animals',
      'The Yardbirds','Cream','The Dave Clark Five','Herman\'s Hermits',
      'The Hollies','Manfred Mann','Gerry and the Pacemakers','The Searchers',
      'The Spencer Davis Group','Small Faces','Traffic','Donovan',
      'Dusty Springfield','Peter and Gordon','Chad and Jeremy',
      'Freddie and the Dreamers','Billy J Kramer','Lulu',
      'The Troggs','The Zombies','The Moody Blues',
    ],
  },

  // ── music: 70s ──
  {
    id: '70s_rock_bands',
    short: '70s rock bands',
    prompt: 'Name as many 70s rock bands or artists as you can.',
    answers: [
      'Led Zeppelin','The Eagles','Fleetwood Mac','Aerosmith','AC/DC',
      'Black Sabbath','Deep Purple','Queen','Lynyrd Skynyrd',
      'Creedence Clearwater Revival','The Allman Brothers Band','ZZ Top',
      'Kansas','Rush','Yes','Genesis','Emerson Lake & Palmer',
      'Crosby Stills Nash & Young','The Band','Tom Petty and the Heartbreakers',
      'Dire Straits','Boston','Foreigner','Journey','REO Speedwagon','Styx',
      'Bad Company','Free','Grand Funk Railroad','Thin Lizzy','KISS','Heart',
      'Blue Oyster Cult','Foghat','Peter Frampton','Supertramp','Electric Light Orchestra',
      'ELO','10cc','Steely Dan','Doobie Brothers','Little Feat',
    ],
  },

  // ── music: 80s ──
  {
    id: '80s_hair_metal',
    short: '80s hair metal bands',
    prompt: 'Name as many 80s hair metal or glam metal bands as you can.',
    answers: [
      'Bon Jovi','Motley Crue','Guns N Roses','Poison','Def Leppard',
      'Warrant','Winger','Cinderella','Ratt','Twisted Sister','Quiet Riot',
      'Dokken','Skid Row','Europe','White Lion','Whitesnake','Scorpions',
      'Van Halen','Slaughter','Tesla','Great White','Vixen','LA Guns',
      'Bulletboys','Faster Pussycat','Dirty Looks','Pretty Boy Floyd',
      'Kix','Trixter','Bang Tango','Steelheart','Hardline',
    ],
  },
  {
    id: '80s_new_wave',
    short: '80s new wave bands',
    prompt: 'Name as many 80s new wave or synth-pop acts as you can.',
    answers: [
      'The Police','Depeche Mode','Duran Duran','Talking Heads','New Order',
      'The Cure','The Smiths','Echo and the Bunnymen','Simple Minds',
      'Human League','A Flock of Seagulls','Soft Cell','Eurythmics',
      'Men at Work','Blondie','Devo','The Pretenders','The B-52s',
      'U2','INXS','Spandau Ballet','Culture Club','Tears for Fears',
      'Thompson Twins','OMD','ABC','Howard Jones','Naked Eyes',
      'Yazoo','Erasure','Pet Shop Boys','Frankie Goes to Hollywood',
      'Ultravox','Japan','Visage','Gary Numan',
    ],
  },
  {
    id: '80s_pop_stars',
    short: '80s pop stars',
    prompt: 'Name as many 80s pop music artists as you can.',
    answers: [
      'Michael Jackson','Madonna','Prince','Whitney Houston','George Michael',
      'Cyndi Lauper','Tina Turner','Lionel Richie','Janet Jackson','Paula Abdul',
      'Rick Astley','New Kids on the Block','Wham!','Phil Collins',
      'Elton John','Billy Joel','Billy Idol','David Bowie','Hall & Oates',
      'Huey Lewis and the News','John Mellencamp','Pat Benatar',
      'Olivia Newton-John','Kim Carnes','Laura Branigan','Debbie Gibson',
      'Tiffany','Belinda Carlisle','Go-Gos','Sheena Easton','Sheila E',
    ],
  },

  // ── music: 90s ──
  {
    id: '90s_grunge_bands',
    short: '90s grunge bands',
    prompt: 'Name as many 90s grunge bands as you can.',
    answers: [
      'Nirvana','Pearl Jam','Soundgarden','Alice in Chains','Stone Temple Pilots',
      'Mudhoney','Screaming Trees','Mother Love Bone','Temple of the Dog',
      'Mad Season','Candlebox','Bush','Silverchair','Blind Melon',
      'Hole','Babes in Toyland','Tad','Melvins','L7','Green River',
      'Skin Yard','Hammerbox','Flop','Malfunkshun','7 Year Bitch',
    ],
  },
  {
    id: '90s_alt_rock',
    short: '90s alternative rock bands',
    prompt: 'Name as many 90s alternative rock bands or artists as you can.',
    answers: [
      'Radiohead','Smashing Pumpkins','Weezer','Beck','Garbage',
      'Nine Inch Nails','Alanis Morissette','Counting Crows','Third Eye Blind',
      'Matchbox Twenty','Collective Soul','Goo Goo Dolls','Hootie and the Blowfish',
      'Sublime','The Cranberries','REM','Oasis','Blur','Pulp','Suede',
      'Portishead','Massive Attack','Sheryl Crow','Liz Phair','PJ Harvey',
      'Elastica','Veruca Salt','Letters to Cleo','Sixpence None the Richer',
      'Semisonic','Fastball','Harvey Danger','Wheatus','Fastball',
      'The Breeders','Pavement','Guided by Voices',
    ],
  },
  {
    id: '90s_pop_stars',
    short: '90s pop stars',
    prompt: 'Name as many 90s pop music artists as you can.',
    answers: [
      'Backstreet Boys','NSYNC','Spice Girls','Britney Spears','Christina Aguilera',
      'Jennifer Lopez','Mariah Carey','Celine Dion','Destiny\'s Child','TLC',
      'En Vogue','Ace of Base','Hanson','Boyz II Men','98 Degrees',
      'Ricky Martin','Enrique Iglesias','Savage Garden','No Doubt','Gwen Stefani',
      'Alanis Morissette','Shania Twain','Faith Hill','Jewel','Sheryl Crow',
      'Natalie Imbruglia','Lisa Loeb','Fiona Apple','Sarah McLachlan',
      'Whitney Houston','Janet Jackson','Madonna (90s peak)','Paula Abdul',
    ],
  },
  {
    id: '90s_rappers',
    short: '90s rappers',
    prompt: 'Name as many 90s rappers or hip-hop artists as you can.',
    answers: [
      'Tupac','Biggie Smalls','Notorious BIG','Jay-Z','Nas','Snoop Dogg',
      'Dr Dre','Ice Cube','Ice-T','LL Cool J','Rakim','Busta Rhymes',
      'DMX','Missy Elliott','Lil Kim','Foxy Brown','Queen Latifah',
      'MC Hammer','Vanilla Ice','Salt-N-Pepa','Method Man','Wu-Tang Clan',
      'Ghostface Killah','Raekwon','GZA','Ol Dirty Bastard','Redman',
      'Warren G','Nate Dogg','Coolio','Bone Thugs-n-Harmony','Outkast',
      'Andre 3000','Big Boi','Ludacris','Juvenile','Lil Wayne (early)',
      'Eminem','Big Pun','Big L','Common','Mos Def','Talib Kweli',
    ],
  },
  {
    id: '90s_rnb',
    short: '90s R&B artists',
    prompt: 'Name as many 90s R&B artists or groups as you can.',
    answers: [
      'TLC','Destiny\'s Child','En Vogue','SWV','Xscape','Total','702',
      'Boyz II Men','All-4-One','112','Dru Hill','Jodeci','New Edition',
      'Bell Biv DeVoe','Guy','Blackstreet','Ginuwine','Keith Sweat',
      'Aaliyah','Brandy','Monica','Mary J Blige','Lauryn Hill',
      'Erykah Badu','D\'Angelo','Maxwell','Joe','Brian McKnight',
      'Usher','R Kelly','Babyface','Toni Braxton','Anita Baker',
      'Luther Vandross','Whitney Houston','Mariah Carey','Janet Jackson',
    ],
  },
  {
    id: '90s_country_artists',
    short: '90s country artists',
    prompt: 'Name as many 90s country music artists as you can.',
    answers: [
      'Garth Brooks','Shania Twain','Tim McGraw','Faith Hill','George Strait',
      'Alan Jackson','Brooks & Dunn','Trisha Yearwood','Vince Gill',
      'Dwight Yoakam','Mary Chapin Carpenter','Reba McEntire','Clint Black',
      'Travis Tritt','John Michael Montgomery','Tracy Lawrence','Mark Chesnutt',
      'Aaron Tippin','Clay Walker','Tracy Byrd','Billy Ray Cyrus',
      'Pam Tillis','Kathy Mattea','Jo Dee Messina','Martina McBride',
      'Lee Roy Parnell','Collin Raye','Doug Stone','Confederate Railroad',
    ],
  },

  // ── music: 2000s ──
  {
    id: '2000s_pop_stars',
    short: '2000s pop stars',
    prompt: 'Name as many 2000s pop music artists as you can.',
    answers: [
      'Beyonce','Kelly Clarkson','Carrie Underwood','Lady Gaga','Katy Perry',
      'Rihanna','Nelly Furtado','Lily Allen','Amy Winehouse','Adele (early)',
      'Pink','Avril Lavigne','Michelle Branch','Vanessa Carlton','Hilary Duff',
      'Ciara','Ne-Yo','Chris Brown','Usher','Justin Timberlake',
      'Fergie','Natasha Bedingfield','Leona Lewis','Jordin Sparks',
      'Jesse McCartney','Aaron Carter','Ashlee Simpson','Lindsay Lohan',
      'Mandy Moore','Kylie Minogue','Robbie Williams','Delta Goodrem',
    ],
  },
  {
    id: '2000s_hip_hop',
    short: '2000s hip-hop artists',
    prompt: 'Name as many 2000s hip-hop artists as you can.',
    answers: [
      'Kanye West','Jay-Z','Eminem','50 Cent','Lil Wayne','T.I.','Ludacris',
      'Young Jeezy','Rick Ross','Nelly','Ja Rule','Lil Jon','Chingy',
      'Fat Joe','Cam\'ron','Dipset','Pharrell','The Neptunes','Timbaland',
      'Common','Talib Kweli','Mos Def','Lupe Fiasco','Wale',
      'Fabolous','Lloyd Banks','Young Buck','Game','The Game',
      'Paul Wall','Mike Jones','Chamillionaire','T-Pain','Akon',
      'Outkast','Missy Elliott','Eve','Keyshia Cole',
    ],
  },

  // ── music: 2010s ──
  {
    id: '2010s_rappers',
    short: '2010s rappers',
    prompt: 'Name as many 2010s rappers or hip-hop artists as you can.',
    answers: [
      'Drake','Kendrick Lamar','J Cole','Travis Scott','Future','Young Thug',
      'Migos','Cardi B','Nicki Minaj','Post Malone','Juice WRLD',
      'XXXTentacion','Lil Uzi Vert','21 Savage','Kodak Black','Lil Baby',
      'Gunna','NBA YoungBoy','Polo G','Pop Smoke','Roddy Ricch',
      'DaBaby','A$AP Rocky','A$AP Mob','Big Sean','Meek Mill',
      'Mac Miller','Logic','Tyler the Creator','Childish Gambino',
      'Frank Ocean','Chance the Rapper','Pusha T','Kid Cudi',
    ],
  },
  {
    id: 'pop_punk_bands',
    short: 'Pop-punk bands',
    prompt: 'Name as many pop-punk bands as you can.',
    answers: [
      'Green Day','Blink-182','The Offspring','Sum 41','Good Charlotte',
      'Simple Plan','Fall Out Boy','Panic at the Disco','My Chemical Romance',
      'Paramore','New Found Glory','MXPX','Yellowcard','Hawthorne Heights',
      'Dashboard Confessional','Taking Back Sunday','Brand New',
      'The Starting Line','Motion City Soundtrack','All Time Low',
      'Mayday Parade','Pierce the Veil','Sleeping with Sirens',
      'A Day to Remember','Forever the Sickest Kids','We the Kings',
      'The Maine','This Providence','Every Avenue',
    ],
  },

  // ── music: timeless genres ──
  {
    id: 'motown_artists',
    short: 'Motown artists',
    prompt: 'Name as many Motown artists or groups as you can.',
    answers: [
      'The Supremes','Diana Ross','Marvin Gaye','Stevie Wonder','The Temptations',
      'The Four Tops','Smokey Robinson','The Miracles','Jackson 5','The Commodores',
      'Lionel Richie','Martha and the Vandellas','The Marvelettes','Mary Wells',
      'Junior Walker','Gladys Knight and the Pips','Eddie Kendricks','David Ruffin',
      'Tammi Terrell','Edwin Starr','Rick James','DeBarge','The Isley Brothers',
      'Boyz II Men','The Contours','Barrett Strong','Kim Weston',
    ],
  },
  {
    id: 'disco_artists',
    short: '70s disco artists',
    prompt: 'Name as many disco artists or groups as you can.',
    answers: [
      'Donna Summer','Bee Gees','Gloria Gaynor','KC and the Sunshine Band',
      'Chic','Sister Sledge','Village People','Sylvester','Earth Wind & Fire',
      'Kool & the Gang','George McCrae','Van McCoy','Heatwave','The Gap Band',
      'The Trammps','Taste of Honey','Patrick Hernandez','Shalamar',
      'Rose Royce','Change','Diana Ross','Labelle','ABBA',
      'Cerrone','Giorgio Moroder','Patrick Cowley','Disco Tex',
    ],
  },
  {
    id: 'jazz_legends',
    short: 'Jazz legends',
    prompt: 'Name as many jazz musicians or legends as you can.',
    answers: [
      'Miles Davis','John Coltrane','Louis Armstrong','Duke Ellington',
      'Charlie Parker','Thelonious Monk','Dizzy Gillespie','Billie Holiday',
      'Ella Fitzgerald','Sarah Vaughan','Nat King Cole','Bill Evans',
      'Oscar Peterson','Dave Brubeck','Stan Getz','Chet Baker','Art Blakey',
      'Herbie Hancock','Wayne Shorter','Freddie Hubbard','Lee Morgan',
      'Wes Montgomery','Joe Pass','Pat Metheny','Charles Mingus',
      'Sonny Rollins','Ornette Coleman','John McLaughlin','Chick Corea',
      'Keith Jarrett','Wynton Marsalis','Branford Marsalis',
    ],
  },
  {
    id: 'classic_country_artists',
    short: 'Classic country artists',
    prompt: 'Name as many classic (pre-90s) country music artists as you can.',
    answers: [
      'Johnny Cash','Hank Williams','Patsy Cline','Loretta Lynn','Tammy Wynette',
      'George Jones','Merle Haggard','Buck Owens','Waylon Jennings','Willie Nelson',
      'Dolly Parton','Conway Twitty','Porter Wagoner','Ernest Tubb','Hank Snow',
      'Webb Pierce','Ray Price','Roger Miller','Charley Pride','Glen Campbell',
      'Kenny Rogers','Don Williams','Crystal Gayle','Emmylou Harris',
      'Barbara Mandrell','Ronnie Milsap','Eddy Arnold','Jim Reeves',
      'Lefty Frizzell','Carl Smith','Red Foley','Webb Pierce',
    ],
  },
  {
    id: 'modern_country_artists',
    short: 'Modern country artists',
    prompt: 'Name as many modern (2000s–present) country artists as you can.',
    answers: [
      'Keith Urban','Brad Paisley','Kenny Chesney','Luke Bryan','Blake Shelton',
      'Miranda Lambert','Carrie Underwood','Taylor Swift','Dierks Bentley',
      'Eric Church','Chris Stapleton','Kacey Musgraves','Maren Morris',
      'Carly Pearce','Morgan Wallen','Luke Combs','Kane Brown','Thomas Rhett',
      'Florida Georgia Line','Sam Hunt','Brett Eldredge','Cole Swindell',
      'Jon Pardi','Chris Young','Jason Aldean','Darius Rucker',
      'Lady Antebellum','Little Big Town','Zac Brown Band','Old Dominion',
      'Midland','Lainey Wilson','Bailey Zimmermann','Jelly Roll',
    ],
  },
  {
    id: 'kpop_groups',
    short: 'K-pop groups & artists',
    prompt: 'Name as many K-pop groups or solo artists as you can.',
    answers: [
      'BTS','BLACKPINK','EXO','TWICE','aespa','ITZY','Red Velvet',
      'Girls Generation','SHINee','GOT7','Monsta X','ATEEZ','Stray Kids',
      'TXT','NCT','MAMAMOO','4Minute','2NE1','T-ara','Wonder Girls',
      'Big Bang','WINNER','iKON','SEVENTEEN','IVE','Le Sserafim',
      'NewJeans','G-IDLE','Kep1er','ENHYPEN','fromis_9','SuperM',
      'BoA','Rain','Psy','Taeyang','G-Dragon','Chungha','Hwasa',
    ],
  },
  {
    id: 'edm_artists',
    short: 'EDM & electronic artists',
    prompt: 'Name as many EDM or electronic music artists or DJs as you can.',
    answers: [
      'Daft Punk','The Chemical Brothers','Prodigy','Fatboy Slim',
      'David Guetta','Skrillex','Deadmau5','Calvin Harris','Avicii',
      'Martin Garrix','Tiesto','Armin van Buuren','Paul Van Dyk',
      'Diplo','Steve Aoki','Zedd','Marshmello','Alan Walker',
      'Swedish House Mafia','Knife Party','Dillon Francis',
      'Porter Robinson','Madeon','Flume','Kygo','Disclosure',
      'Chase & Status','Sub Focus','Aphex Twin','Four Tet','Burial',
      'Skream','Benga','Nero','Example','Example','Rusko',
      'Major Lazer','Bassnectar','Pretty Lights','Feed Me',
    ],
  },

  // ── video games ──
  {
    id: 'console_brands',
    short: 'Video game consoles',
    prompt: 'Name as many video game consoles as you can.',
    answers: [
      'NES','SNES','Nintendo 64','GameCube','Wii','Wii U','Switch','Switch 2',
      'Game Boy','Game Boy Advance','Nintendo DS','Nintendo 3DS',
      'PlayStation','PlayStation 2','PlayStation 3','PlayStation 4','PlayStation 5',
      'PSP','PS Vita',
      'Xbox','Xbox 360','Xbox One','Xbox Series X','Xbox Series S',
      'Sega Genesis','Sega Saturn','Dreamcast','Sega Master System','Game Gear',
      'Atari 2600','Atari Jaguar','Atari Lynx','Neo Geo','TurboGrafx-16',
      'Steam Deck',
    ],
  },
  {
    id: 'mario_games',
    short: 'Mario games',
    prompt: 'Name as many Super Mario games as you can.',
    answers: [
      'Super Mario Bros','Super Mario Bros 2','Super Mario Bros 3',
      'Super Mario World','Super Mario 64','Super Mario Sunshine',
      'Super Mario Galaxy','Super Mario Galaxy 2','Super Mario 3D Land',
      'Super Mario 3D World','Super Mario Odyssey','Super Mario Bros Wonder',
      'Mario Kart','Mario Kart 64','Mario Kart Double Dash','Mario Kart Wii',
      'Mario Kart 7','Mario Kart 8','Mario Kart 8 Deluxe',
      'Super Smash Bros','Super Smash Bros Melee','Super Smash Bros Brawl',
      'Super Smash Bros for Wii U','Super Smash Bros Ultimate',
      'Mario Party','Paper Mario','Mario & Luigi','Mario Golf','Mario Tennis',
      'Dr Mario','Yoshi\'s Island','Wario Land','WarioWare',
    ],
  },
  {
    id: 'call_of_duty_games',
    short: 'Call of Duty games',
    prompt: 'Name as many Call of Duty games as you can.',
    answers: [
      'Call of Duty','Call of Duty 2','Call of Duty 3',
      'Call of Duty 4 Modern Warfare','Call of Duty Modern Warfare',
      'Call of Duty World at War',
      'Call of Duty Modern Warfare 2','Call of Duty MW2',
      'Call of Duty Black Ops','Call of Duty Black Ops II','Call of Duty Black Ops III',
      'Call of Duty Black Ops 4','Call of Duty Black Ops Cold War',
      'Call of Duty Modern Warfare 3','Call of Duty MW3',
      'Call of Duty Ghosts','Call of Duty Advanced Warfare',
      'Call of Duty Infinite Warfare','Call of Duty WW2',
      'Call of Duty Vanguard','Call of Duty Modern Warfare 2022',
      'Call of Duty Warzone','Call of Duty Mobile',
    ],
  },
  {
    id: 'gta_games',
    short: 'Grand Theft Auto games',
    prompt: 'Name as many Grand Theft Auto games as you can.',
    answers: [
      'Grand Theft Auto','GTA','Grand Theft Auto 2','GTA 2',
      'Grand Theft Auto III','GTA 3','Grand Theft Auto Vice City','GTA Vice City',
      'Grand Theft Auto San Andreas','GTA San Andreas',
      'Grand Theft Auto Liberty City Stories','Grand Theft Auto Vice City Stories',
      'Grand Theft Auto IV','GTA 4','The Lost and Damned','The Ballad of Gay Tony',
      'Grand Theft Auto Chinatown Wars','Grand Theft Auto V','GTA 5','GTA Online',
      'Grand Theft Auto VI','GTA 6',
    ],
  },
  {
    id: 'zelda_games',
    short: 'Zelda games',
    prompt: 'Name as many Legend of Zelda games as you can.',
    answers: [
      'The Legend of Zelda','Adventure of Link','A Link to the Past',
      'Link\'s Awakening','Ocarina of Time','Majora\'s Mask',
      'Oracle of Ages','Oracle of Seasons','The Wind Waker',
      'Four Swords Adventures','Twilight Princess','Phantom Hourglass',
      'Spirit Tracks','Skyward Sword','A Link Between Worlds',
      'Hyrule Warriors','Breath of the Wild','Tears of the Kingdom',
      'Hyrule Warriors Age of Calamity',
    ],
  },
  {
    id: 'fps_games',
    short: 'FPS games',
    prompt: 'Name as many first-person shooter games as you can.',
    answers: [
      'Doom','Doom II','Quake','Half-Life','Half-Life 2','Counter-Strike',
      'Halo','Halo 2','Halo 3','Halo Reach','Halo 4','Halo 5','Halo Infinite',
      'Call of Duty','Battlefield','Battlefield 4','Battlefield 1','Battlefield 2042',
      'Titanfall','Titanfall 2','Apex Legends','Valorant','Overwatch','Overwatch 2',
      'Rainbow Six Siege','Escape from Tarkov','Hunt Showdown',
      'Wolfenstein','Return to Castle Wolfenstein','Wolfenstein The New Order',
      'Bioshock','Bioshock Infinite','System Shock','Deus Ex',
      'Metro 2033','Metro Exodus','Stalker','Far Cry','Far Cry 2','Far Cry 3',
      'Borderlands','Borderlands 2','Borderlands 3','Deep Rock Galactic',
      'Destiny','Destiny 2','The Division','The Division 2',
      'Payday','Payday 2','Left 4 Dead','Left 4 Dead 2','Back 4 Blood',
    ],
  },
  {
    id: 'rpg_games',
    short: 'RPG games',
    prompt: 'Name as many RPG (role-playing) games as you can.',
    answers: [
      'Final Fantasy','Final Fantasy VII','Final Fantasy VIII','Final Fantasy IX',
      'Final Fantasy X','Final Fantasy XII','Final Fantasy XIII','Final Fantasy XV','Final Fantasy XVI',
      'Dragon Quest','Chrono Trigger','Secret of Mana','Earthbound',
      'The Elder Scrolls','Morrowind','Oblivion','Skyrim','Starfield',
      'Fallout','Fallout 2','Fallout 3','Fallout New Vegas','Fallout 4',
      'Baldur\'s Gate','Baldur\'s Gate 3','Planescape Torment',
      'Neverwinter Nights','Pillars of Eternity','Tyranny',
      'Diablo','Diablo II','Diablo III','Diablo IV','Path of Exile',
      'Dark Souls','Dark Souls II','Dark Souls III','Bloodborne','Elden Ring',
      'Sekiro','Nioh','Nioh 2',
      'The Witcher','The Witcher 2','The Witcher 3',
      'Mass Effect','Mass Effect 2','Mass Effect 3','Mass Effect Andromeda',
      'Dragon Age Origins','Dragon Age II','Dragon Age Inquisition',
      'Persona 3','Persona 4','Persona 5',
      'Xenogears','Xenoblade Chronicles','Xenoblade Chronicles 2',
      'Monster Hunter','Pokemon','Pokemon Red','Pokemon Blue','Pokemon Gold','Pokemon Silver',
    ],
  },
  {
    id: 'sports_games',
    short: 'Sports video games',
    prompt: 'Name as many sports video games or franchises as you can.',
    answers: [
      'FIFA','FC','Madden NFL','NBA 2K','NHL','MLB The Show',
      'PGA Tour','Tony Hawk\'s Pro Skater','SSX','Wave Race',
      'Rocket League','eFootball','Pro Evolution Soccer','PES',
      'NBA Live','NBA Street','NFL Street','FIFA Street',
      'Boxing games','Fight Night','Fight Night Round 4',
      'WCW vs NWO','WWF No Mercy','WWE SmackDown','WWE 2K',
      'Tecmo Bowl','Blitz the League',
      'Gran Turismo','Forza','Forza Motorsport','Forza Horizon',
      'Need for Speed','Burnout','Ridge Racer','Daytona USA',
      'Mario Kart',
    ],
  },
  {
    id: 'minecraft_mobs',
    short: 'Minecraft mobs',
    prompt: 'Name as many Minecraft mobs as you can.',
    answers: [
      'Creeper','Zombie','Skeleton','Spider','Enderman','Blaze','Ghast',
      'Witch','Villager','Iron Golem','Snow Golem','Pig','Cow','Chicken',
      'Sheep','Horse','Donkey','Mule','Llama','Rabbit','Bat','Bee',
      'Cat','Dog','Wolf','Fox','Panda','Turtle','Dolphin','Squid',
      'Glow Squid','Guardian','Elder Guardian','Shulker','Slime','Magma Cube',
      'Cave Spider','Silverfish','Endermite','Hoglin','Piglin','Strider',
      'Zoglin','Phantom','Drowned','Husk','Stray','Wither Skeleton',
      'Evoker','Vindicator','Pillager','Ravager','Vex',
      'Warden','Allai','Frog','Tadpole','Camel','Sniffer',
    ],
  },
  {
    id: 'fortnite_characters',
    short: 'Fortnite skins/characters',
    prompt: 'Name as many Fortnite skins or characters as you can.',
    answers: [
      'Jonesy','Ramirez','Wildcat','Harley Quinn','Batman','Spider-Man',
      'Master Chief','Kratos','Geralt','Naruto','Goku','Vegeta',
      'Thanos','Darth Vader','Indiana Jones','Rick Sanchez','Peter Griffin',
      'The Mandalorian','Groot','Iron Man','Black Widow','Captain America',
      'Deadpool','Wolverine','Storm','Mystique','Silver Surfer',
      'Midas','Meowscles','Kit','Peely','Fishstick','Ghoul Trooper',
      'Skull Trooper','Black Knight','Galaxy','Renegade Raider',
    ],
  },
  {
    id: 'minecraft_items',
    short: 'Minecraft items & blocks',
    prompt: 'Name as many Minecraft items or blocks as you can.',
    answers: [
      'Dirt','Grass','Stone','Cobblestone','Sand','Gravel','Wood','Log',
      'Planks','Crafting Table','Furnace','Chest','Torch','Ladder','Door',
      'Fence','Bed','Bookshelf','Jukebox','Note Block','Dispenser','Piston',
      'Sticky Piston','Observer','Hopper','Dropper','Comparator','Repeater',
      'Redstone','Redstone Torch','Lever','Button','Pressure Plate','Tripwire',
      'Diamond','Iron','Gold','Emerald','Lapis Lazuli','Coal','Netherite',
      'Diamond Ore','Iron Ore','Gold Ore','Coal Ore','Emerald Ore',
      'Diamond Block','Iron Block','Gold Block','Emerald Block',
      'Sword','Pickaxe','Axe','Shovel','Hoe','Bow','Arrow','Crossbow',
      'Shield','Helmet','Chestplate','Leggings','Boots','Elytra',
      'Apple','Bread','Cooked Beef','Steak','Porkchop','Chicken','Fish','Cod','Salmon',
      'Carrot','Potato','Baked Potato','Melon','Pumpkin','Mushroom Stew',
      'Golden Apple','Enchanted Golden Apple','Cake','Cookie','Pie',
      'Bucket','Water Bucket','Lava Bucket','Milk Bucket','Powder Snow Bucket',
      'Boat','Minecart','Saddle','Lead','Name Tag','Map','Compass','Clock',
      'Flint and Steel','Shears','Fishing Rod','Trident','Spyglass',
      'Potion','Splash Potion','Lingering Potion','Ender Pearl','Eye of Ender',
      'Blaze Rod','Ghast Tear','Wither Skull','Dragon Egg','Beacon',
      'Anvil','Grindstone','Stonecutter','Smithing Table','Loom',
      'Wool','Carpet','Banner','Painting','Item Frame','Armor Stand',
      'TNT','Firework Rocket','Snow Ball','Egg','Bone','Bone Meal',
    ],
  },
  {
    id: 'minecraft_biomes',
    short: 'Minecraft biomes & dimensions',
    prompt: 'Name as many Minecraft biomes or dimensions as you can.',
    answers: [
      'Plains','Forest','Dark Forest','Birch Forest','Jungle','Taiga','Snowy Taiga',
      'Desert','Savanna','Swamp','Mangrove Swamp','Beach','Stone Shore',
      'Ocean','Deep Ocean','Cold Ocean','Warm Ocean','Lukewarm Ocean','Frozen Ocean',
      'River','Frozen River',
      'Mountains','Windswept Hills','Stony Peaks','Jagged Peaks','Frozen Peaks',
      'Badlands','Eroded Badlands','Wooded Badlands',
      'Meadow','Cherry Grove','Flower Forest','Sunflower Plains',
      'Mushroom Fields','Ice Spikes','Bamboo Jungle',
      'Cave','Dripstone Caves','Lush Caves','Deep Dark',
      'Nether','Nether Wastes','Soul Sand Valley','Crimson Forest','Warped Forest',
      'Basalt Deltas','End','The End','End Highlands','End Midlands',
      'Small End Islands','End Barrens',
    ],
  },
  {
    id: 'minecraft_enchantments',
    short: 'Minecraft enchantments',
    prompt: 'Name as many Minecraft enchantments as you can.',
    answers: [
      'Sharpness','Smite','Bane of Arthropods','Knockback','Fire Aspect','Looting',
      'Sweeping Edge','Efficiency','Silk Touch','Unbreaking','Fortune',
      'Power','Punch','Flame','Infinity','Luck of the Sea','Lure',
      'Impaling','Riptide','Loyalty','Channeling',
      'Multishot','Piercing','Quick Charge',
      'Protection','Fire Protection','Blast Protection','Projectile Protection','Feather Falling',
      'Respiration','Aqua Affinity','Depth Strider','Frost Walker','Thorns',
      'Swift Sneak','Soul Speed','Curse of Binding','Curse of Vanishing',
      'Mending',
    ],
  },
  {
    id: 'nintendo_64_games',
    short: 'Nintendo 64 games',
    prompt: 'Name as many Nintendo 64 games as you can.',
    answers: [
      'Super Mario 64','The Legend of Zelda Ocarina of Time','The Legend of Zelda Majoras Mask',
      'Mario Kart 64','Super Smash Bros','Star Fox 64','GoldenEye 007','GoldenEye',
      'Donkey Kong 64','Banjo-Kazooie','Banjo-Tooie','Conkers Bad Fur Day',
      'Paper Mario','Mario Party','Mario Party 2','Mario Party 3',
      'Pokemon Stadium','Pokemon Stadium 2','Pokemon Snap','Pokemon Puzzle League',
      'Kirby 64 The Crystal Shards','Yoshi\'s Story','F-Zero X',
      'Wave Race 64','Pilotwings 64','Diddy Kong Racing','1080 Snowboarding',
      'Jet Force Gemini','Perfect Dark','Turok','Turok 2','Turok 3',
      'WWF No Mercy','WWE Wrestlemania 2000','Wrestlemania 2000',
      'Tony Hawk\'s Pro Skater','Tony Hawk 2','NFL Blitz',
      'Blast Corps','Body Harvest','Ogre Battle 64','Mystical Ninja',
    ],
  },
  {
    id: 'wii_games',
    short: 'Wii games',
    prompt: 'Name as many Wii games as you can.',
    answers: [
      'Wii Sports','Wii Play','Wii Fit','Wii Fit Plus','Wii Sports Resort',
      'Wii Music','Wii Party','Just Dance',
      'Super Mario Galaxy','Super Mario Galaxy 2','New Super Mario Bros Wii',
      'Mario Kart Wii','Super Smash Bros Brawl','Mario Party 8','Mario Party 9',
      'The Legend of Zelda Twilight Princess','The Legend of Zelda Skyward Sword',
      'Donkey Kong Country Returns','Kirby Epic Yarn','Kirby Return to Dream Land',
      'Metroid Prime 3 Corruption','Punch-Out','Sin and Punishment',
      'Xenoblade Chronicles','Pikmin','Pikmin 2','Animal Crossing City Folk',
      'Pokemon Battle Revolution','Pokemon Ranch',
      'Rayman Origins','Rayman Legends','Sonic Colors','Sonic Unleashed',
      'Guitar Hero III','Guitar Hero World Tour','Rock Band','Rock Band 2',
      'Lego Star Wars','Lego Indiana Jones','Lego Batman','Lego Harry Potter',
      'Resident Evil 4','Resident Evil Umbrella Chronicles',
      'Monster Hunter Tri','No More Heroes','Madworld',
    ],
  },
  {
    id: 'nintendo_switch_games',
    short: 'Nintendo Switch games',
    prompt: 'Name as many Nintendo Switch games as you can.',
    answers: [
      'The Legend of Zelda Breath of the Wild','The Legend of Zelda Tears of the Kingdom',
      'Super Mario Odyssey','Super Mario Party','New Super Mario Bros U Deluxe',
      'Mario Kart 8 Deluxe','Super Smash Bros Ultimate',
      'Animal Crossing New Horizons','Splatoon 2','Splatoon 3',
      'Pokemon Sword and Shield','Pokemon Scarlet and Violet',
      'Pokemon Legends Arceus','Pokemon Let\'s Go Pikachu',
      'Kirby Star Allies','Kirby and the Forgotten Land',
      'Metroid Dread','Metroid Prime Remastered',
      'Xenoblade Chronicles 2','Xenoblade Chronicles 3',
      'Fire Emblem Three Houses','Fire Emblem Engage',
      'Bayonetta 3','Astral Chain','Arms','Ring Fit Adventure',
      'Luigi Mansion 3','Paper Mario The Origami King',
      'Pikmin 3 Deluxe','Pikmin 4',
      'Hades','Hollow Knight','Celeste','Stardew Valley',
      'Minecraft','Fortnite','Overwatch 2','Rocket League',
      'Persona 5 Royal','Octopath Traveler','Triangle Strategy',
      'It Takes Two','Cuphead','Undertale','Disco Elysium',
    ],
  },
  {
    id: 'fortnite_weapons',
    short: 'Fortnite weapons',
    prompt: 'Name as many Fortnite weapons as you can.',
    answers: [
      'Assault Rifle','AR','Tactical Shotgun','Pump Shotgun','Combat Shotgun',
      'Heavy Shotgun','Bolt-Action Sniper','Semi-Auto Sniper','Hunting Rifle',
      'Submachine Gun','SMG','Light Machine Gun','LMG','Minigun',
      'Pistol','Hand Cannon','Revolver','Heavy Sniper','Infantry Rifle',
      'Grenade Launcher','Rocket Launcher','RPG',
      'Grenade','Clingers','Remote Explosive','C4','Shockwave Grenade',
      'Boogie Bomb','Shadow Bomb','Port-a-Fort','Launch Pad',
      'Stink Grenade','Firefly Jar','Thermal Fish',
      'Chug Jug','Shield Potion','Small Shield','Medkit','Bandages','Slurp Juice',
      'Flint-Knock Pistol','Charge Shotgun','Dragon\'s Breath Shotgun',
      'Primal Bow','Mechanical Bow','Flame Bow',
      'Lightsaber','Thanos Gauntlet','Web Shooters','Symbiote',
    ],
  },
  {
    id: 'fortnite_locations',
    short: 'Fortnite locations',
    prompt: 'Name as many Fortnite named locations as you can.',
    answers: [
      'Tilted Towers','Dusty Depot','Dusty Divot','Pleasant Park','Salty Springs',
      'Retail Row','Greasy Grove','Anarchy Acres','Fatal Fields','Flush Factory',
      'Haunted Hills','Lonely Lodge','Loot Lake','Lucky Landing','Moisty Mire',
      'Paradise Palms','Risky Reels','Shifty Shafts','Snobby Shores','Tomato Town',
      'Wailing Woods','Polar Peak','Happy Hamlet','Sunny Steps','Frosty Flights',
      'Lazy Lagoon','Mega Mall','Neo Tilted','Pressure Plant','Salty Springs',
      'Slurpy Swamp','The Block','Steamy Stacks','Frenzy Farm',
      'Holly Hedges','Misty Meadows','Dirty Docks','Catty Corner',
      'Believer Beach','Coral Castle','Stealthy Stronghold',
      'Coney Crossroads','Logjam Lumberyard','Rocky Reels',
      'The Daily Bugle','Sanctuary','Titled Towers','Butter Barn',
    ],
  },
  {
    id: 'video_game_characters',
    short: 'Video game characters',
    prompt: 'Name as many video game characters as you can.',
    answers: [
      'Mario','Luigi','Princess Peach','Bowser','Yoshi','Donkey Kong','Link',
      'Princess Zelda','Ganondorf','Pikachu','Charizard','Mewtwo',
      'Master Chief','Gordon Freeman','Lara Croft','Samus Aran',
      'Sonic the Hedgehog','Tails','Knuckles','Shadow','Amy Rose',
      'Mega Man','Zero','Bass','Protoman',
      'Pac-Man','Kirby','King Dedede','Meta Knight',
      'Sephiroth','Cloud Strife','Tifa Lockhart','Aerith','Squall Leonhart',
      'Solid Snake','Big Boss','Raiden','Liquid Snake',
      'Kratos','Geralt of Rivia','Arthur Morgan','Nathan Drake',
      'Joel','Ellie','Marcus Fenix','Dominic Santiago',
      'Commander Shepard','Ratchet','Clank','Jak','Daxter',
      'Spyro','Crash Bandicoot','Ape Escape','Jak & Daxter',
      'Altair','Ezio Auditore','Connor Kenway','Edward Kenway',
      'Agent 47','Hitman',
    ],
  },

  // ── science / nature ──
  {
    id: 'elements',
    short: 'Chemical elements',
    prompt: 'Name as many chemical elements as you can.',
    answers: [
      'Hydrogen','Helium','Lithium','Beryllium','Boron','Carbon','Nitrogen',
      'Oxygen','Fluorine','Neon','Sodium','Magnesium','Aluminum','Silicon',
      'Phosphorus','Sulfur','Chlorine','Argon','Potassium','Calcium',
      'Scandium','Titanium','Vanadium','Chromium','Manganese','Iron','Cobalt',
      'Nickel','Copper','Zinc','Gallium','Germanium','Arsenic','Selenium',
      'Bromine','Krypton','Rubidium','Strontium','Yttrium','Zirconium',
      'Niobium','Molybdenum','Technetium','Ruthenium','Rhodium','Palladium',
      'Silver','Cadmium','Indium','Tin','Antimony','Tellurium','Iodine','Xenon',
      'Cesium','Barium','Lanthanum','Cerium','Gold','Mercury','Lead','Platinum',
      'Tungsten','Uranium','Plutonium','Radium','Radon','Neon',
    ],
  },
  {
    id: 'space_missions',
    short: 'Space missions',
    prompt: 'Name as many famous space missions as you can.',
    answers: [
      'Apollo 11','Apollo 13','Apollo 1','Mercury','Gemini',
      'Voyager 1','Voyager 2','Pioneer 10','Pioneer 11',
      'Hubble Space Telescope','James Webb Space Telescope',
      'Curiosity Rover','Perseverance Rover','Opportunity Rover','Spirit Rover',
      'Mars Pathfinder','InSight','MAVEN','Cassini','Juno',
      'New Horizons','Dawn','MESSENGER','OSIRIS-REx',
      'International Space Station','ISS','Skylab','Mir',
      'STS-1','Challenger','Columbia',
      'Artemis','SpaceX Dragon','Crew Dragon','Starship',
    ],
  },

  // ── pop culture miscellaneous ──
  {
    id: 'marvel_heroes',
    short: 'Marvel superheroes',
    prompt: 'Name as many Marvel Comics superheroes as you can.',
    answers: [
      'Spider-Man','Iron Man','Captain America','Thor','The Hulk','Black Widow',
      'Hawkeye','Ant-Man','Doctor Strange','Black Panther','Captain Marvel',
      'Scarlet Witch','Vision','Falcon','Winter Soldier','War Machine',
      'Deadpool','Wolverine','Cyclops','Jean Grey','Storm','Rogue','Gambit',
      'Beast','Iceman','Colossus','Jubilee','Psylocke','Nightcrawler','Banshee',
      'Daredevil','Luke Cage','Jessica Jones','Iron Fist','Punisher','Elektra',
      'Ms Marvel','She-Hulk','Squirrel Girl','Moon Knight','Blade','Ghost Rider',
      'Silver Surfer','Galactus','Nick Fury','Agent Coulson','Nova','Rocket Raccoon',
      'Groot','Star-Lord','Gamora','Drax','Nebula','Mantis','Adam Warlock',
    ],
  },
  {
    id: 'dc_heroes',
    short: 'DC superheroes',
    prompt: 'Name as many DC Comics superheroes as you can.',
    answers: [
      'Superman','Batman','Wonder Woman','The Flash','Green Lantern','Aquaman',
      'Cyborg','Martian Manhunter','Shazam','Green Arrow','Black Canary',
      'Nightwing','Batgirl','Batwoman','Robin','Tim Drake','Damian Wayne',
      'Supergirl','Superboy','Power Girl','Hawkman','Hawkgirl','Zatanna',
      'Constantine','Swamp Thing','Animal Man','Blue Beetle','Booster Gold',
      'The Atom','Elongated Man','Plastic Man','Firestorm','Vixen',
      'Black Lightning','Static Shock','Mister Miracle','Big Barda',
      'Raven','Starfire','Beast Boy','Terra','Deathstroke',
    ],
  },
  {
    id: 'disney_princesses',
    short: 'Disney princesses',
    prompt: 'Name as many Disney princesses as you can.',
    answers: [
      'Snow White','Cinderella','Aurora','Sleeping Beauty','Ariel','Belle',
      'Jasmine','Pocahontas','Mulan','Tiana','Rapunzel','Merida','Moana',
      'Raya','Anna','Elsa',
    ],
  },
  {
    id: 'youtube_channels',
    short: 'Famous YouTubers',
    prompt: 'Name as many famous YouTube creators as you can.',
    answers: [
      'PewDiePie','MrBeast','T-Series','Cocomelon','Like Nastya',
      'Ryan\'s World','Dude Perfect','BLACKPINK','Justin Bieber',
      'Mark Rober','Veritasium','Vsauce','CGP Grey','Kurzgesagt',
      'Linus Tech Tips','Marques Brownlee','MKBHD','Dave2D',
      'Ninja','Markiplier','Jacksepticeye','VanossGaming','CoryxKenshin',
      'Valkyrae','Pokimane','xQc','Ludwig','HasanAbi',
      'KSI','Logan Paul','Jake Paul','David Dobrik','Emma Chamberlain',
      'James Charles','NikkieTutorials','Jeffree Star',
      'Gordon Ramsay','Jamie Oliver','BuzzFeed',
      'Good Mythical Morning','Rhett and Link',
    ],
  },
  {
    id: 'social_media_apps',
    short: 'Social media apps',
    prompt: 'Name as many social media apps or platforms as you can.',
    answers: [
      'Facebook','Instagram','Twitter','X','TikTok','Snapchat','YouTube',
      'LinkedIn','Pinterest','Reddit','Tumblr','Twitch','Discord',
      'WhatsApp','Telegram','Signal','WeChat','Line','KakaoTalk',
      'Clubhouse','BeReal','Threads','Mastodon','Bluesky',
      'MySpace','Google+','Vine','Periscope','Meerkat',
    ],
  },
  {
    id: 'fast_food_chains',
    short: 'Fast food chains',
    prompt: 'Name as many fast food restaurant chains as you can.',
    answers: [
      'McDonald\'s','Burger King','Wendy\'s','Chick-fil-A','Taco Bell',
      'KFC','Popeyes','Raising Cane\'s','Zaxby\'s',
      'Subway','Quiznos','Jimmy John\'s','Jersey Mike\'s','Firehouse Subs',
      'Chipotle','Qdoba','Moe\'s',
      'Pizza Hut','Dominos','Papa John\'s','Little Caesars','Papa Murphy\'s',
      'Starbucks','Dunkin\'','Tim Hortons','Peet\'s','Caribou Coffee',
      'Dairy Queen','Baskin-Robbins','Coldstone Creamery',
      'Five Guys','Shake Shack','In-N-Out Burger','Whataburger','Culver\'s',
      'Hardee\'s','Carl\'s Jr','Jack in the Box','Sonic','Arby\'s',
      'Panda Express','Wingstop','Buffalo Wild Wings',
    ],
  },
  {
    id: 'car_brands',
    short: 'Car brands',
    prompt: 'Name as many car brands or manufacturers as you can.',
    answers: [
      'Toyota','Honda','Ford','Chevrolet','BMW','Mercedes-Benz','Audi','Volkswagen',
      'Nissan','Hyundai','Kia','Subaru','Mazda','Mitsubishi','Lexus','Infiniti',
      'Acura','Porsche','Ferrari','Lamborghini','Maserati','Alfa Romeo','Fiat',
      'Volvo','Saab','SEAT','Skoda','Peugeot','Citroën','Renault','Bugatti',
      'Rolls-Royce','Bentley','Jaguar','Land Rover','Range Rover','Aston Martin',
      'Tesla','Rivian','Lucid','Fisker',
      'GMC','Buick','Cadillac','Dodge','Chrysler','Jeep','Ram',
      'Lincoln','Mercury','Oldsmobile','Pontiac','Saturn',
      'Genesis','BYD','Geely','Great Wall',
    ],
  },
  {
    id: 'tech_companies',
    short: 'Tech companies',
    prompt: 'Name as many technology companies as you can.',
    answers: [
      'Apple','Microsoft','Google','Amazon','Meta','Netflix','Tesla',
      'Nvidia','AMD','Intel','Qualcomm','TSMC','Samsung','Sony',
      'IBM','Oracle','Salesforce','SAP','Shopify','Stripe','PayPal',
      'Uber','Lyft','Airbnb','DoorDash','Instacart',
      'Twitter','Snap','TikTok','ByteDance','Tencent','Alibaba','Baidu',
      'Adobe','Autodesk','Unity','Epic Games','Valve','EA','Activision',
      'Ubisoft','Take-Two Interactive','Rockstar Games','Blizzard',
      'SpaceX','Blue Origin','Boeing','Lockheed Martin','Northrop Grumman',
      'Zoom','Slack','Dropbox','Box','Atlassian','GitHub','GitLab',
      'Dell','HP','Lenovo','Asus','Acer','LG','Panasonic','Toshiba',
    ],
  },
  {
    id: 'cocktails_drinks',
    short: 'Cocktails & drinks',
    prompt: 'Name as many cocktails or mixed drinks as you can.',
    answers: [
      'Margarita','Mojito','Old Fashioned','Negroni','Manhattan','Martini',
      'Cosmopolitan','Daiquiri','Whiskey Sour','Sidecar','Gimlet','Aperol Spritz',
      'Long Island Iced Tea','Piña Colada','Mai Tai','Tequila Sunrise',
      'Sex on the Beach','Harvey Wallbanger','Screwdriver','Bloody Mary',
      'Mimosa','Bellini','Kir Royale','Champagne',
      'Tom Collins','Gin and Tonic','Gin Fizz','Singapore Sling',
      'Rum and Coke','Cuba Libre','Dark and Stormy','Moscow Mule',
      'White Russian','Black Russian','Espresso Martini','Irish Coffee',
      'Hot Toddy','Mulled Wine','Sangria','Mulled Cider',
      'Beer','Lager','Ale','IPA','Stout','Porter','Wheat Beer',
    ],
  },
];

// ── post-processing: aliases for "Boston Celtics" -> also "Celtics" ──
function addAliasShortName(items) {
  return items.map((it) => {
    const main = typeof it === 'string' ? it : it[0];
    if (typeof main !== 'string') return it;
    const parts = main.split(' ');
    if (parts.length < 2) return it;
    const aliases = [main, parts[parts.length - 1], parts.slice(-2).join(' ')];
    return Array.from(new Set(aliases));
  });
}

// ── fetcher ──
async function fetchJson(url, attempt = 0) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return fetchJson(url, attempt + 1);
    }
    throw e;
  }
}

function dedupeStrings(arr) {
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    const key = String(s).toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(s).trim());
  }
  return out;
}

async function build() {
  const out = [];
  // Run inline first
  for (const c of INLINE) {
    out.push(c);
    console.log(`  inline: ${c.short.padEnd(28)} ${c.answers.length} items`);
  }
  // Fetch each remote
  for (const src of SOURCES) {
    try {
      const json = await fetchJson(src.url);
      const raw = src.extract(json);
      const cleaned = dedupeStrings(raw);
      if (cleaned.length < 6) {
        console.warn(`  skip: ${src.id} only ${cleaned.length} items`);
        continue;
      }
      let answers = cleaned;
      if (src.aliasShort) answers = addAliasShortName(cleaned);
      out.push({ id: src.id, short: src.short, prompt: src.prompt, answers });
      console.log(`  ok:     ${src.short.padEnd(28)} ${cleaned.length} items`);
    } catch (e) {
      console.warn(`  FAIL:   ${src.id} (${e.message})`);
    }
  }
  const json = JSON.stringify(out);
  for (const p of OUT_PATHS) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, json);
  }
  const total = out.reduce((n, c) => n + c.answers.length, 0);
  console.log(`\nWrote ${out.length} categories (${total} total answers) to ${OUT_PATHS.length} paths.`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
