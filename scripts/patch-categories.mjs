// Quick patch over mg-categories.json:
//   - Removes soccer + 80s hair metal categories
//   - Adds modern Gen Z trivia categories
// Run after fetch-categories.mjs (or standalone).
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PATHS = [
  path.join(__dirname, '..', 'data', 'mg-categories.json'),
  path.join(__dirname, '..', 'client', 'src', 'minigame', 'data', 'mg-categories.json'),
];

const REMOVE_IDS = new Set([
  'premier_league_clubs',
  'ucl_winners',
  'fifa_world_cup',
  'soccer_players',
  '80s_hair_metal',
]);

const GEN_Z = [
  {
    id: 'mcu_movies',
    short: 'Marvel MCU movies',
    prompt: 'Name as many Marvel Cinematic Universe movies as you can.',
    answers: [
      'Iron Man','Iron Man 2','Iron Man 3','The Incredible Hulk',
      'Thor','Thor The Dark World','Thor Ragnarok','Thor Love and Thunder',
      'Captain America The First Avenger','Captain America The Winter Soldier','Captain America Civil War','Captain America Brave New World',
      'The Avengers','Avengers Age of Ultron','Avengers Infinity War','Avengers Endgame',
      'Guardians of the Galaxy','Guardians of the Galaxy Vol 2','Guardians of the Galaxy Vol 3',
      'Ant-Man','Ant-Man and the Wasp','Ant-Man and the Wasp Quantumania',
      'Doctor Strange','Doctor Strange in the Multiverse of Madness',
      'Spider-Man Homecoming','Spider-Man Far From Home','Spider-Man No Way Home',
      'Black Panther','Black Panther Wakanda Forever',
      'Captain Marvel','The Marvels','Shang-Chi','Eternals','Black Widow','Deadpool and Wolverine',
    ],
  },
  {
    id: 'netflix_shows_recent',
    short: 'Popular Netflix shows',
    prompt: 'Name as many popular Netflix original shows as you can.',
    answers: [
      'Stranger Things','Wednesday','Squid Game','The Crown','Bridgerton',
      'Ozark','Money Heist','Dark','Mindhunter','Black Mirror',
      'You','The Witcher','Lupin','Cobra Kai','Outer Banks',
      ['BoJack Horseman','Bojack'],'Narcos','Orange is the New Black','House of Cards',
      'Tiger King','Love is Blind','Selling Sunset','Queen Charlotte','Beef',
      'Ginny and Georgia','Heartstopper','Never Have I Ever','Emily in Paris',
      'The Queens Gambit','Inventing Anna','Dahmer','Maid','13 Reasons Why',
      'Sex Education','Arcane','Avatar The Last Airbender',
    ],
  },
  {
    id: 'tiktok_creators',
    short: 'Top TikTok creators',
    prompt: 'Name as many top TikTok creators as you can.',
    answers: [
      ['Khaby Lame','Khaby'],['Charli DAmelio','Charli'],['MrBeast'],
      ['Bella Poarch'],['Addison Rae'],['Zach King'],['Dixie DAmelio','Dixie'],
      ['Will Smith'],['Kimberly Loaiza'],['BurnoutChamp','Burnout'],
      ['Spencer X'],['Brent Rivera'],['Loren Gray'],['Michael Le'],
      ['JoJo Siwa','JoJo'],['Lil Huddy','LilHuddy'],['Noah Beck'],
      ['Avani Gregg','Avani'],['Chase Hudson'],['James Charles'],
      ['Emma Chamberlain','Emma'],['Tabitha Brown','Tabitha'],['Tana Mongeau'],
      ['David Dobrik','Dobrik'],['Hailey Bieber'],['Kylie Jenner'],
      ['Doja Cat','Doja'],['Drake'],['Lizzo'],
    ],
  },
  {
    id: 'fortnite_skins',
    short: 'Fortnite skins/characters',
    prompt: 'Name as many Fortnite skins or icon-series characters as you can.',
    answers: [
      'Peely','Drift','Midas','Travis Scott','Marshmello','Naruto','Goku','Spider-Man',
      'Deadpool','Wolverine','Iron Man','Thor','Thanos','Batman','Joker','Harley Quinn',
      'Master Chief','Kratos','Aloy','Lara Croft','John Wick','The Mandalorian',
      'Baby Yoda','Grogu','Boba Fett','Darth Vader','Luke Skywalker','Rey',
      'Eminem','Ariana Grande','Lebron James','Naomi Osaka','Neymar',
      ['Skull Trooper','Skull'],['Ghoul Trooper','Ghoul'],['Renegade Raider','Renegade'],
      'Black Knight','Raven','Dark Voyager','Tomato Head','Beef Boss','Rick Sanchez',
      'Morty','Predator','Carnage','Venom','Doctor Doom','Storm','Cable',
    ],
  },
  {
    id: 'genz_slang',
    short: 'Gen Z slang words',
    prompt: 'Name as many Gen Z slang words as you can.',
    answers: [
      ['bussin'],['slay'],['no cap','nocap'],['cap'],['bet'],['mid'],
      ['rizz'],['lowkey'],['highkey'],['based'],['cringe'],['cheugy'],
      ['vibe','vibes'],['lit'],['fire'],['slaps'],['sus'],['bruh'],
      ['simp'],['stan'],['ghosted'],['salty'],['shook'],['woke'],
      ['ate'],['serving','serving cunt'],['ick'],['bop'],['main character'],
      ['delulu'],['gyat'],['ohio'],['npc'],['skibidi'],['fanum tax'],
      ['mewing'],['gigachad'],['its giving','giving'],['period','periodt'],
      ['drip'],['flex'],['glow up'],['ghosting'],['snatched'],['tea'],
    ],
  },
  {
    id: 'kpop_groups',
    short: 'K-pop groups',
    prompt: 'Name as many K-pop groups as you can.',
    answers: [
      'BTS','Blackpink','Twice','Stray Kids','NewJeans','LE SSERAFIM','ITZY','Aespa',
      'Red Velvet','EXO','Big Bang','Girls Generation','Super Junior','SHINee',
      ['2NE1'],['G-IDLE','GIDLE','(G)I-DLE'],'IVE','TXT','Tomorrow X Together',
      'Seventeen','Got7','Monsta X','NCT','NCT 127','NCT Dream','WayV',
      'ATEEZ','Enhypen','TXT','MAMAMOO','Apink','Wanna One','iKON',
      'Day6','Pentagon','The Boyz','Astro','Cravity','Treasure','Riize',
      'Boynextdoor','Zerobaseone','ZB1','BamBam','BoA','PSY',
    ],
  },
  {
    id: 'viral_songs_recent',
    short: 'Recent viral hits',
    prompt: 'Name as many viral songs from the last few years as you can.',
    answers: [
      'Old Town Road','Savage','WAP','Roxanne','Drivers License','Good 4 U',
      'Stay','Heat Waves','As It Was','About Damn Time','Bad Habit','Anti-Hero',
      'Flowers','Cruel Summer','Vampire','Espresso','Please Please Please',
      'Birds of a Feather','Like That','Not Like Us','I Had Some Help',
      'A Bar Song','Beautiful Things','Greedy','Lovin On Me','Million Dollar Baby',
      'Texas Hold Em','Houdini','Apple','Pink Pony Club','Good Luck Babe',
      'Espresso','Fortnight','Lose Control','Cant Catch Me Now','Stick Season',
      'Snooze','Kill Bill','Boys A Liar','Unholy','Cuff It','First Class',
      'Industry Baby','Levitating','Blinding Lights','Watermelon Sugar','Dynamite',
    ],
  },
  {
    id: 'meme_characters',
    short: 'Famous meme characters',
    prompt: 'Name as many famous meme characters or formats as you can.',
    answers: [
      ['Pepe','Pepe the Frog'],'Doge','Cheems','Wojak','Chad','Soyjak',
      'Trollface','Rage Comics','Forever Alone','Y U No Guy','Bad Luck Brian',
      'Success Kid','Disaster Girl','Distracted Boyfriend','Drake','Galaxy Brain',
      'Stonks','Spongebob','Mocking Spongebob','Patrick','Squidward',
      'Shrek','Big Chungus','Among Us','Sussy','Among Us crewmate',
      'Drakeposting','Hide the Pain Harold','Crying Wojak','GigaChad',
      'NPC Wojak','Doomer','Coomer','Boomer','Zoomer',
      ['Roll Safe'],'Surprised Pikachu','Confused Math Lady','This is Fine',
      ['Salt Bae'],'Tom and Jerry','Walter White Approves',
    ],
  },
];

function patch(p) {
  if (!fs.existsSync(p)) { console.log(`skip (not found): ${p}`); return; }
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const filtered = data.filter(c => !REMOVE_IDS.has(c.id));
  const existingIds = new Set(filtered.map(c => c.id));
  for (const c of GEN_Z) {
    if (existingIds.has(c.id)) continue;
    filtered.push(c);
  }
  fs.writeFileSync(p, JSON.stringify(filtered));
  console.log(`patched ${p}: ${data.length} → ${filtered.length} (-${data.length - filtered.length + GEN_Z.length} removed, +${GEN_Z.length} added)`);
}

for (const p of PATHS) patch(p);
