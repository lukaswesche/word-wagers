// Audit + massively expand mg-categories.json.
//   1. Normalizes existing entries: trims, deduplicates, removes empty.
//   2. Adds dozens of new inline categories.
//   3. Writes both data/ and client/src/minigame/data/ copies.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PATHS = [
  path.join(__dirname, '..', 'data', 'mg-categories.json'),
  path.join(__dirname, '..', 'client', 'src', 'minigame', 'data', 'mg-categories.json'),
];

// ──────────────────────────────────────────────────────────
// NEW CATEGORIES — bulk add. Each has: id, short, prompt, answers.
// answers entries are either a string (canonical) or [canonical, ...aliases]
// ──────────────────────────────────────────────────────────
const NEW = [
  // ── GAMING ──
  { id: 'mario_characters', short: 'Mario universe characters', prompt: 'Name as many characters from the Mario series as you can.', answers: [
    'Mario','Luigi','Princess Peach','Princess Daisy','Bowser','Bowser Jr','Yoshi','Toad','Toadette',
    'Wario','Waluigi','Rosalina','Birdo','Donkey Kong','Diddy Kong','Funky Kong','Cranky Kong',
    'King Boo','Boo','Goomba','Koopa Troopa','Shy Guy','Lakitu','Piranha Plant','Chain Chomp',
    'Kamek','Pauline','Captain Toad','Petey Piranha','Wiggler','Magikoopa','Hammer Bro',
    'Dry Bones','Dry Bowser','Larry','Morton','Wendy','Iggy','Roy','Lemmy','Ludwig',
  ]},
  { id: 'zelda_characters', short: 'Legend of Zelda characters', prompt: 'Name as many Zelda characters as you can.', answers: [
    'Link','Zelda','Ganondorf','Ganon','Impa','Sheik','Midna','Skull Kid','Tingle',
    'Saria','Malon','Darunia','Ruto','Navi','Tatl','Tael','Fi','Ghirahim','Demise',
    'Vaati','Agahnim','Daphnes','King Rhoam','Mipha','Daruk','Revali','Urbosa','Riju','Yunobo','Sidon','Teba',
    'Beedle','Purah','Robbie','Hestu','Kass','Tulin','Calamity Ganon','Linkle',
  ]},
  { id: 'pokemon_starters', short: 'Pokémon starter Pokémon', prompt: 'Name as many starter Pokémon (any generation) as you can.', answers: [
    'Bulbasaur','Charmander','Squirtle','Chikorita','Cyndaquil','Totodile',
    'Treecko','Torchic','Mudkip','Turtwig','Chimchar','Piplup','Snivy','Tepig','Oshawott',
    'Chespin','Fennekin','Froakie','Rowlet','Litten','Popplio','Grookey','Scorbunny','Sobble',
    'Sprigatito','Fuecoco','Quaxly',
  ]},
  { id: 'fortnite_locations', short: 'Fortnite locations', prompt: 'Name as many Fortnite map locations (current or past) as you can.', answers: [
    'Tilted Towers','Pleasant Park','Retail Row','Salty Springs','Loot Lake','Greasy Grove',
    'Anarchy Acres','Wailing Woods','Junk Junction','Snobby Shores','Lonely Lodge','Lazy Links',
    'Risky Reels','Paradise Palms','Sunny Steps','Lucky Landing','Tomato Town','Tomato Temple',
    'Polar Peak','Frosty Flights','Happy Hamlet','Fatal Fields','Dusty Divot','Dusty Depot',
    'Sweaty Sands','Holly Hedges','Slurpy Swamp','Misty Meadows','Catty Corner','Steamy Stacks',
    'Logjam Lumberyard','Coney Crossroads','Camp Cuddle','Greasy Grove','Tilted Towers',
    'Mega City','Knotty Nets','Shady Stilts','Ritzy Riviera','Cherry Blossom',
  ]},
  { id: 'minecraft_mobs', short: 'Minecraft mobs', prompt: 'Name as many Minecraft mobs as you can.', answers: [
    'Creeper','Zombie','Skeleton','Spider','Enderman','Cow','Pig','Sheep','Chicken','Wolf',
    'Cat','Ocelot','Villager','Iron Golem','Snow Golem','Witch','Slime','Magma Cube',
    'Ghast','Blaze','Wither Skeleton','Wither','Ender Dragon','Guardian','Elder Guardian',
    'Drowned','Husk','Stray','Phantom','Pillager','Vindicator','Evoker','Ravager',
    'Vex','Polar Bear','Fox','Bee','Panda','Llama','Mule','Donkey','Rabbit',
    'Squid','Glow Squid','Salmon','Cod','Pufferfish','Axolotl','Goat','Allay','Warden',
    'Sniffer','Frog','Tadpole','Hoglin','Zoglin','Piglin','Piglin Brute','Strider','Camel',
    'Trader Llama','Wandering Trader','Parrot','Bat','Mooshroom','Silverfish','Endermite',
  ]},
  { id: 'roblox_games', short: 'Popular Roblox games', prompt: 'Name as many popular Roblox games as you can.', answers: [
    'Adopt Me','Brookhaven','MeepCity','Royale High','Jailbreak','Murder Mystery 2','Bloxburg',
    'Tower of Hell','Piggy','Doors','Blox Fruits','Pet Simulator X','Pet Simulator 99',
    'Pls Donate','Natural Disaster Survival','Work at a Pizza Place','Phantom Forces',
    'Build a Boat for Treasure','Arsenal','BedWars','Mad City','Theme Park Tycoon','Lumber Tycoon',
    'Anime Defenders','Anime Adventures','Project Slayers','Blade Ball','Driving Empire',
    'Speed Run 4','Welcome to Bloxburg','Funky Friday','Evade','Shindo Life',
  ]},
  { id: 'overwatch_heroes', short: 'Overwatch heroes', prompt: 'Name as many Overwatch heroes as you can.', answers: [
    'Tracer','Reinhardt','Genji','Hanzo','Mercy','D.Va','Soldier 76','Reaper','Widowmaker',
    'Pharah','Mei','Lucio','Ana','Zenyatta','Junkrat','Roadhog','Symmetra','Torbjorn','Bastion',
    'McCree','Cassidy','Sombra','Doomfist','Moira','Brigitte','Wrecking Ball','Ashe','Echo',
    'Sigma','Baptiste','Sojourn','Junker Queen','Kiriko','Ramattra','Lifeweaver','Illari',
    'Mauga','Venture','Juno','Hazard','Orisa','Winston','Zarya',
  ]},
  { id: 'league_champions', short: 'League of Legends champions', prompt: 'Name as many LoL champions as you can.', answers: [
    'Ahri','Akali','Yasuo','Yone','Lee Sin','Jinx','Ezreal','Lux','Garen','Darius',
    'Katarina','Kayle','Annie','Veigar','Ziggs','Heimerdinger','Riven','Master Yi','Jax',
    'Vi','Caitlyn','Vayne','Draven','Lucian','Sivir','Tristana','Twitch','Kog Maw','Miss Fortune',
    'Ashe','Varus','Senna','Aphelios','Samira','Zeri','Sett','Aatrox','Camille','Fiora',
    'Irelia','Jayce','Renekton','Trundle','Wukong','Rengar','Kha Zix','Nidalee','Diana',
    'Leona','Pantheon','Soraka','Sona','Janna','Nami','Thresh','Blitzcrank','Pyke',
    'Zed','Talon','Akshan','Bel Veth','Briar','Hwei','Naafiri','K Sante','Milio','Smolder',
    'Aurora','Skarner','Vex','Yuumi','Renata Glasc','Gwen','Viego','Sylas',
  ]},
  { id: 'smash_bros_fighters', short: 'Smash Bros fighters', prompt: 'Name as many Super Smash Bros fighters as you can.', answers: [
    'Mario','Luigi','Peach','Daisy','Bowser','Bowser Jr','Yoshi','Donkey Kong','Diddy Kong',
    'Wario','Link','Zelda','Sheik','Ganondorf','Young Link','Toon Link','Samus','Dark Samus',
    'Zero Suit Samus','Kirby','Meta Knight','King Dedede','Fox','Falco','Wolf','Pikachu',
    'Pichu','Jigglypuff','Mewtwo','Pokemon Trainer','Charizard','Squirtle','Ivysaur','Lucario',
    'Greninja','Incineroar','Captain Falcon','Ness','Lucas','Marth','Roy','Ike','Lucina','Robin',
    'Corrin','Chrom','Byleth','Olimar','R.O.B.','Mr Game and Watch','Pit','Dark Pit','Palutena',
    'Wii Fit Trainer','Little Mac','Villager','Isabelle','Duck Hunt','Inkling','Min Min',
    'Snake','Sonic','Mega Man','Pac-Man','Ryu','Ken','Cloud','Bayonetta','Sephiroth','Hero',
    'Banjo Kazooie','Terry','Steve','Pyra','Mythra','Kazuya','Sora','Joker',
  ]},
  { id: 'gta_games', short: 'GTA games', prompt: 'Name as many Grand Theft Auto games as you can.', answers: [
    'Grand Theft Auto','GTA 2','GTA III','GTA Vice City','GTA San Andreas','GTA Advance',
    'GTA Liberty City Stories','GTA Vice City Stories','GTA IV','GTA Episodes from Liberty City',
    'GTA The Lost and Damned','GTA The Ballad of Gay Tony','GTA Chinatown Wars','GTA V','GTA Online','GTA VI',
  ]},
  { id: 'call_of_duty_games', short: 'Call of Duty games', prompt: 'Name as many Call of Duty games as you can.', answers: [
    'Call of Duty','Call of Duty 2','Call of Duty 3','Modern Warfare','Modern Warfare 2','Modern Warfare 3',
    'World at War','Black Ops','Black Ops II','Black Ops III','Black Ops IV','Black Ops Cold War','Black Ops 6',
    'Ghosts','Advanced Warfare','Infinite Warfare','WWII','Vanguard','Warzone','Mobile','Finest Hour','Big Red One',
    'MW Remastered','MW2 Remastered','MW 2019','MW II','MW III',
  ]},

  // ── TV / MOVIES ──
  { id: 'star_wars_characters', short: 'Star Wars characters', prompt: 'Name as many Star Wars characters as you can.', answers: [
    'Luke Skywalker','Princess Leia','Han Solo','Darth Vader','Yoda','Obi-Wan Kenobi','Chewbacca',
    'C-3PO','R2-D2','BB-8','Lando Calrissian','Boba Fett','Jango Fett','Anakin Skywalker',
    'Padme Amidala','Qui-Gon Jinn','Mace Windu','Count Dooku','Darth Maul','Palpatine','Emperor Palpatine',
    'Kylo Ren','Rey','Finn','Poe Dameron','General Hux','Captain Phasma','Snoke','Maz Kanata',
    'Jabba the Hutt','Greedo','Wedge Antilles','Admiral Ackbar','Mon Mothma','Ahsoka Tano',
    'Captain Rex','Cad Bane','Asajj Ventress','General Grievous','The Mandalorian','Din Djarin',
    'Grogu','Baby Yoda','Bo-Katan','Cara Dune','Moff Gideon','Cassian Andor','Jyn Erso',
    'K-2SO','Saw Gerrera','Ezra Bridger','Kanan Jarrus','Hera Syndulla','Sabine Wren','Zeb','Chopper',
  ]},
  { id: 'harry_potter_characters', short: 'Harry Potter characters', prompt: 'Name as many Harry Potter characters as you can.', answers: [
    'Harry Potter','Ron Weasley','Hermione Granger','Albus Dumbledore','Severus Snape','Minerva McGonagall',
    'Rubeus Hagrid','Voldemort','Tom Riddle','Sirius Black','Remus Lupin','Peter Pettigrew','Bellatrix Lestrange',
    'Lucius Malfoy','Draco Malfoy','Narcissa Malfoy','Lily Potter','James Potter','Ginny Weasley',
    'Fred Weasley','George Weasley','Percy Weasley','Bill Weasley','Charlie Weasley','Molly Weasley','Arthur Weasley',
    'Neville Longbottom','Luna Lovegood','Cho Chang','Cedric Diggory','Viktor Krum','Fleur Delacour','Gabrielle Delacour',
    'Dolores Umbridge','Cornelius Fudge','Kingsley Shacklebolt','Mad Eye Moody','Nymphadora Tonks',
    'Bellatrix','Dobby','Kreacher','Nearly Headless Nick','Moaning Myrtle','Filch','Mrs Norris',
    'Argus Filch','Pomona Sprout','Filius Flitwick','Horace Slughorn','Quirinus Quirrell','Gilderoy Lockhart',
    'Alastor Moody','Igor Karkaroff','Madam Pomfrey','Madam Hooch','Sybill Trelawney','Firenze',
    'Crabbe','Goyle','Pansy Parkinson','Seamus Finnigan','Dean Thomas','Lavender Brown','Parvati Patil',
    'Padma Patil','Oliver Wood','Angelina Johnson','Hedwig','Buckbeak','Fawkes','Crookshanks','Scabbers',
  ]},
  { id: 'breaking_bad_characters', short: 'Breaking Bad characters', prompt: 'Name as many Breaking Bad characters as you can.', answers: [
    'Walter White','Jesse Pinkman','Skyler White','Walter White Jr','Hank Schrader','Marie Schrader',
    'Saul Goodman','Mike Ehrmantraut','Gustavo Fring','Gus Fring','Tuco Salamanca','Hector Salamanca',
    'Tio Salamanca','Marco Salamanca','Leonel Salamanca','Lalo Salamanca','Nacho Varga',
    'Todd Alquist','Lydia Rodarte Quayle','Ted Beneke','Holly White','Combo','Skinny Pete','Badger',
    'Brock','Andrea','Jane Margolis','Donald Margolis','Krazy 8','Spooge','Tortuga','Don Eladio',
    'Heisenberg','Huell','Patrick Kuby','Old Joe','Declan',
  ]},
  { id: 'simpsons_characters', short: 'Simpsons characters', prompt: 'Name as many Simpsons characters as you can.', answers: [
    'Homer Simpson','Marge Simpson','Bart Simpson','Lisa Simpson','Maggie Simpson','Abe Simpson','Grampa Simpson',
    'Ned Flanders','Maude Flanders','Rod Flanders','Todd Flanders','Mr Burns','Smithers','Moe','Barney Gumble',
    'Apu','Manjula','Krusty','Sideshow Bob','Sideshow Mel','Milhouse','Nelson Muntz','Martin Prince',
    'Ralph Wiggum','Chief Wiggum','Principal Skinner','Edna Krabappel','Otto','Groundskeeper Willie',
    'Lunchlady Doris','Mayor Quimby','Lenny','Carl','Disco Stu','Comic Book Guy','Professor Frink','Dr Hibbert',
    'Dr Nick','Reverend Lovejoy','Helen Lovejoy','Kent Brockman','Selma Bouvier','Patty Bouvier','Itchy','Scratchy',
    'Duffman','Hans Moleman','Jimbo Jones','Kearney','Dolph','Snake','Fat Tony','Cletus','Brandine','Lou','Eddie',
  ]},
  { id: 'office_us_characters', short: 'The Office (US) characters', prompt: 'Name as many characters from The Office (US) as you can.', answers: [
    'Michael Scott','Jim Halpert','Pam Beesly','Dwight Schrute','Andy Bernard','Stanley Hudson',
    'Phyllis Vance','Kevin Malone','Oscar Martinez','Angela Martin','Meredith Palmer','Creed Bratton',
    'Kelly Kapoor','Ryan Howard','Toby Flenderson','Erin Hannon','Holly Flax','Roy Anderson','Karen Filippelli',
    'Robert California','Nellie Bertram','Gabe Lewis','Clark Green','Pete Miller','David Wallace','Jan Levinson',
    'Bob Vance','Mose Schrute','Hank','Darryl Philbin','Bill Buttlicker','Glenn','Charles Miner',
  ]},
  { id: 'avatar_last_airbender', short: 'Avatar: The Last Airbender characters', prompt: 'Name as many characters from Avatar: The Last Airbender as you can.', answers: [
    'Aang','Katara','Sokka','Toph','Zuko','Iroh','Azula','Mai','Ty Lee','Suki','Appa','Momo',
    'Ozai','Bumi','Roku','Kyoshi','Yangchen','Kuruk','Yue','Hakoda','Bato','Pakku','Jet','Long Feng',
    'Bumi the King','Wan Shi Tong','Combustion Man','Piandao','Jeong Jeong','June','Cabbage Merchant',
    'Korra','Mako','Bolin','Asami Sato','Tenzin','Lin Beifong','Tarrlok','Amon','Kuvira','Zaheer','Unalaq',
  ]},
  { id: 'studio_ghibli_films', short: 'Studio Ghibli films', prompt: 'Name as many Studio Ghibli films as you can.', answers: [
    'My Neighbor Totoro','Spirited Away','Princess Mononoke','Howls Moving Castle','Castle in the Sky',
    'Nausicaa','Kikis Delivery Service','Porco Rosso','Grave of the Fireflies','Whisper of the Heart',
    'Ponyo','The Wind Rises','From Up on Poppy Hill','Arrietty','When Marnie Was There','Tales from Earthsea',
    'The Tale of the Princess Kaguya','Only Yesterday','Pom Poko','My Neighbors the Yamadas','Ocean Waves',
    'The Cat Returns','Earwig and the Witch','The Boy and the Heron','Mary and the Witchs Flower',
  ]},
  { id: 'disney_villains', short: 'Disney villains', prompt: 'Name as many Disney villains as you can.', answers: [
    'Maleficent','Ursula','Jafar','Scar','Cruella de Vil','Hades','Captain Hook','Gaston','Queen of Hearts',
    'Evil Queen','Mother Gothel','Yzma','Dr Facilier','Frollo','Shere Khan','Shan Yu','Ratcliffe',
    'Hopper','Stinky Pete','Sid','Lotso','Syndrome','Bowler Hat Guy','Charles Muntz','Te Fiti','Tamatoa',
    'King Candy','Bellwether','Hans','Davy Jones','Barbossa','Cutler Beckett','Randall Boggs','Henry J Waternoose',
    'Tai Lung','Lord Shen','Kaa','Madame Medusa','Edgar','Sir Hiss','Prince John','Lady Tremaine',
  ]},
  { id: 'horror_movies', short: 'Horror movies', prompt: 'Name as many horror movies as you can.', answers: [
    'The Exorcist','Halloween','The Shining','A Nightmare on Elm Street','Friday the 13th','Scream',
    'The Texas Chain Saw Massacre','Psycho','Rosemarys Baby','The Omen','Carrie','Poltergeist',
    'The Conjuring','Annabelle','The Nun','Insidious','Sinister','Hereditary','Midsommar','Get Out',
    'Us','Nope','It','It Chapter Two','The Thing','Alien','Aliens','The Babadook','It Follows',
    'The Witch','The Lighthouse','Saw','Hostel','The Ring','The Grudge','Paranormal Activity',
    'The Blair Witch Project','Cabin in the Woods','Evil Dead','Dead Alive','Pet Sematary','Misery',
    'Final Destination','28 Days Later','Train to Busan','Bird Box','A Quiet Place','Smile',
    'Talk to Me','M3GAN','Barbarian','X','Pearl','Skinamarink','Longlegs','The Substance','Speak No Evil',
  ]},

  // ── MUSIC ──
  { id: 'taylor_swift_songs', short: 'Taylor Swift songs', prompt: 'Name as many Taylor Swift songs as you can.', answers: [
    'Love Story','Blank Space','Shake It Off','Bad Blood','Anti-Hero','Cruel Summer','Cardigan',
    'You Belong with Me','Mean','Mine','Sparks Fly','Back to December','22','I Knew You Were Trouble',
    'We Are Never Ever Getting Back Together','Style','Wildest Dreams','Out of the Woods','New Romantics',
    'Look What You Made Me Do','Delicate','End Game','Gorgeous','Ready for It','Me','You Need to Calm Down',
    'Lover','The Man','Cornelia Street','Daylight','Willow','Champagne Problems','August','Betty',
    'Exile','The 1','Mirrorball','Mad Woman','Marjorie','Tolerate It','Long Story Short','Right Where You Left Me',
    'All Too Well','Red','22','We Are Never','Begin Again','State of Grace','Holy Ground','I Almost Do',
    'Karma','Lavender Haze','Bejeweled','Snow on the Beach','Vigilante Shit','Maroon','Midnight Rain',
    'Fortnight','I Can Do It With a Broken Heart','Down Bad','But Daddy I Love Him','So Long London',
    'Florida','The Smallest Man Who Ever Lived','Who Is She','I Hate It Here','Imgonnagetyouback',
  ]},
  { id: 'beatles_songs', short: 'Beatles songs', prompt: 'Name as many Beatles songs as you can.', answers: [
    'Hey Jude','Let It Be','Yesterday','Help','Something','Here Comes the Sun','Come Together',
    'Twist and Shout','I Want to Hold Your Hand','She Loves You','Love Me Do','Please Please Me',
    'A Hard Days Night','Cant Buy Me Love','Eight Days a Week','Ticket to Ride','We Can Work It Out',
    'Day Tripper','Drive My Car','Norwegian Wood','In My Life','Michelle','Yellow Submarine',
    'Eleanor Rigby','Tomorrow Never Knows','Paperback Writer','Penny Lane','Strawberry Fields Forever',
    'Sgt Peppers Lonely Hearts Club Band','A Day in the Life','Lucy in the Sky with Diamonds',
    'When Im Sixty-Four','All You Need Is Love','Magical Mystery Tour','I Am the Walrus','Hello Goodbye',
    'Lady Madonna','Revolution','Back in the USSR','Dear Prudence','Glass Onion','Ob-La-Di Ob-La-Da',
    'While My Guitar Gently Weeps','Helter Skelter','Blackbird','Get Back','The Long and Winding Road',
    'Across the Universe','Octopuss Garden','I Me Mine','Two of Us','I Saw Her Standing There',
  ]},
  { id: 'drake_songs', short: 'Drake songs', prompt: 'Name as many Drake songs as you can.', answers: [
    'Hotline Bling','Gods Plan','In My Feelings','One Dance','Started from the Bottom','The Motto',
    'Headlines','Best I Ever Had','Forever','Take Care','Marvins Room','Crew Love','HYFR','Worst Behavior',
    'Trophies','Energy','Know Yourself','10 Bands','Used To','Legend','6 God','Back to Back','Where Ya At',
    'Jumpman','Nice for What','Nonstop','Gods Plan','Im Upset','Mob Ties','Talk Up','Yes Indeed','Walk It Talk It',
    'Toosie Slide','Laugh Now Cry Later','What Did I Miss','First Person Shooter','Rich Flex','Major Distribution',
    'Spin Bout U','Privileged Rappers','Search and Rescue','Slime You Out','You Broke My Heart','Push Ups','Family Matters',
    'Champagne Poetry','Fair Trade','Way 2 Sexy','Knife Talk','Girls Want Girls','Falling Back','Sticky','Massive',
  ]},
  { id: 'rap_artists', short: 'Rap artists', prompt: 'Name as many rappers as you can.', answers: [
    'Drake','Eminem','Kendrick Lamar','J Cole','Jay-Z','Kanye West','Nas','Biggie Smalls','Tupac',
    'Lil Wayne','Lil Baby','Lil Uzi Vert','Future','Travis Scott','Post Malone','21 Savage',
    'Cardi B','Nicki Minaj','Megan Thee Stallion','Doja Cat','Latto','Ice Spice','Glorilla',
    'Sexyy Red','Tyler the Creator','A$AP Rocky','Asap Rocky','Asap Ferg','Schoolboy Q','Pusha T',
    'Rick Ross','DJ Khaled','Lil Yachty','Lil Pump','Playboi Carti','Ken Carson','Destroy Lonely',
    'Don Toliver','Gunna','Young Thug','Quavo','Offset','Takeoff','Migos','Metro Boomin','Hit-Boy',
    'Mac Miller','XXXTentacion','Juice Wrld','Pop Smoke','Bobby Shmurda','Doja Cat','Snoop Dogg','Dr Dre',
    'Method Man','Ghostface Killah','RZA','GZA','Wu-Tang Clan','Bone Thugs','Andre 3000','Big Boi',
    'Outkast','Common','Mos Def','Talib Kweli','MF Doom','Bun B','Lil Jon','TI','Ludacris','Three 6 Mafia',
  ]},

  // ── FOOD / DRINK ──
  { id: 'sushi_types', short: 'Sushi/Japanese food', prompt: 'Name as many Japanese sushi or food dishes as you can.', answers: [
    'Salmon','Tuna','Yellowtail','Eel','Shrimp','California Roll','Spicy Tuna Roll','Rainbow Roll',
    'Dragon Roll','Philadelphia Roll','Nigiri','Sashimi','Maki','Temaki','Uramaki','Hand Roll',
    'Ramen','Udon','Soba','Tempura','Gyoza','Edamame','Miso Soup','Yakitori','Yakisoba','Tonkatsu',
    'Katsu','Donburi','Onigiri','Takoyaki','Okonomiyaki','Sukiyaki','Shabu Shabu','Mochi','Dango',
    'Daifuku','Taiyaki','Dorayaki','Anpan','Karaage','Curry Rice','Omurice','Chirashi','Sake',
  ]},
  { id: 'fast_food_chains', short: 'Fast food chains', prompt: 'Name as many fast food restaurants as you can.', answers: [
    'McDonalds','Burger King','Wendys','Taco Bell','KFC','Subway','Chick-fil-A','Chipotle','Panera',
    'Five Guys','In-N-Out','Shake Shack','Whataburger','Sonic','Arbys','Jack in the Box','Carls Jr',
    'Hardees','Dairy Queen','White Castle','Culvers','Steak n Shake','Popeyes','Bojangles',
    'Raising Canes','Zaxbys','Pizza Hut','Dominos','Papa Johns','Little Caesars','Papa Murphys',
    'Jersey Mikes','Jimmy Johns','Firehouse Subs','Quiznos','Auntie Annes','Cinnabon','Dunkin',
    'Starbucks','Krispy Kreme','Tim Hortons','Panda Express','PF Changs','Qdoba','Moes',
    'Del Taco','Chickfila','Wing Stop','Wingstop','Buffalo Wild Wings','Hooters','IHOP','Dennys',
    'Cracker Barrel','Waffle House','Applebees','TGI Fridays','Olive Garden','Red Lobster',
  ]},
  { id: 'ice_cream_flavors', short: 'Ice cream flavors', prompt: 'Name as many ice cream flavors as you can.', answers: [
    'Vanilla','Chocolate','Strawberry','Mint Chocolate Chip','Cookies and Cream','Cookie Dough',
    'Rocky Road','Pistachio','Butter Pecan','Neapolitan','Rocky Road','Coffee','Mocha','Caramel',
    'Salted Caramel','Cherry','Peach','Mango','Lemon','Lime','Coconut','Banana','Raspberry',
    'Blueberry','Blackberry','Pineapple','Watermelon','Bubblegum','Cotton Candy','Birthday Cake',
    'Red Velvet','Cinnamon','Pumpkin','Eggnog','Maple','Honey','Lavender','Matcha','Green Tea',
    'Black Sesame','Taro','Ube','Mango Sticky Rice','Cherry Garcia','Phish Food','Half Baked',
    'Cherry Vanilla','Rum Raisin','Tutti Frutti','Tiger Tail','Spumoni','Sherbet','Sorbet',
  ]},
  { id: 'pizza_chains', short: 'Pizza chains', prompt: 'Name as many pizza chains as you can.', answers: [
    'Dominos','Pizza Hut','Papa Johns','Little Caesars','Papa Murphys','Marcos','Round Table',
    'Hungry Howies','Jets Pizza','Mountain Mikes','Mod Pizza','Blaze Pizza','Pieology','Mellow Mushroom',
    'California Pizza Kitchen','CPK','BJs','Sbarro','Cicis','Pizza Inn','Pizza Ranch','Brooklyn Pizza',
    'Grimaldis','Patxis','Detroit Style Pizza','Loui Loui','Buddys','Pizza My Heart','Original Tommys',
    'Stevi Bs','Donatos','Toppers','Toppers Pizza','Imos','Imos Pizza','Pizza Pizza','Boston Pizza',
  ]},

  // ── COUNTRIES / GEO ──
  { id: 'african_countries', short: 'African countries', prompt: 'Name as many African countries as you can.', answers: [
    'Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon',
    'Central African Republic','Chad','Comoros','Congo','Democratic Republic of the Congo','Cote dIvoire',
    'Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana',
    'Guinea','Guinea-Bissau','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali',
    'Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda',
    'Sao Tome and Principe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa',
    'South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe',
  ]},
  { id: 'asian_countries', short: 'Asian countries', prompt: 'Name as many Asian countries as you can.', answers: [
    'Afghanistan','Armenia','Azerbaijan','Bahrain','Bangladesh','Bhutan','Brunei','Cambodia',
    'China','Cyprus','Georgia','India','Indonesia','Iran','Iraq','Israel','Japan','Jordan',
    'Kazakhstan','Kuwait','Kyrgyzstan','Laos','Lebanon','Malaysia','Maldives','Mongolia',
    'Myanmar','Nepal','North Korea','Oman','Pakistan','Palestine','Philippines','Qatar',
    'Saudi Arabia','Singapore','South Korea','Sri Lanka','Syria','Taiwan','Tajikistan',
    'Thailand','Timor Leste','Turkey','Turkmenistan','UAE','United Arab Emirates','Uzbekistan',
    'Vietnam','Yemen',
  ]},
  { id: 'south_american_countries', short: 'South American countries', prompt: 'Name as many South American countries as you can.', answers: [
    'Argentina','Bolivia','Brazil','Chile','Colombia','Ecuador','Guyana','Paraguay','Peru',
    'Suriname','Uruguay','Venezuela','French Guiana',
  ]},
  { id: 'world_languages', short: 'World languages', prompt: 'Name as many languages spoken around the world as you can.', answers: [
    'English','Mandarin','Chinese','Spanish','Hindi','Arabic','Bengali','Portuguese','Russian',
    'Japanese','German','French','Italian','Korean','Vietnamese','Turkish','Tamil','Urdu',
    'Persian','Farsi','Polish','Ukrainian','Romanian','Dutch','Greek','Swedish','Norwegian','Danish',
    'Finnish','Hungarian','Czech','Slovak','Bulgarian','Serbian','Croatian','Hebrew','Thai',
    'Indonesian','Malay','Tagalog','Filipino','Swahili','Zulu','Xhosa','Afrikaans','Amharic','Yoruba',
    'Igbo','Hausa','Punjabi','Gujarati','Marathi','Telugu','Kannada','Malayalam','Sinhala','Burmese',
    'Khmer','Lao','Mongolian','Latin','Welsh','Irish','Scottish Gaelic','Catalan','Basque','Galician',
    'Esperanto','Sign Language','American Sign Language','ASL',
  ]},

  // ── BRANDS / EVERYDAY ──
  { id: 'car_brands', short: 'Car brands', prompt: 'Name as many car brands/makes as you can.', answers: [
    'Toyota','Honda','Ford','Chevrolet','Chevy','Nissan','Hyundai','Kia','Subaru','Mazda',
    'Volkswagen','VW','Audi','BMW','Mercedes','Mercedes-Benz','Porsche','Volvo','Saab','Skoda','SEAT',
    'Fiat','Alfa Romeo','Lamborghini','Ferrari','Maserati','Lancia','Bentley','Rolls Royce','Aston Martin',
    'Jaguar','Land Rover','Range Rover','Mini','Cadillac','Buick','GMC','Lincoln','Chrysler','Dodge','RAM',
    'Jeep','Tesla','Rivian','Lucid','Polestar','Genesis','Acura','Infiniti','Lexus','Mitsubishi',
    'Suzuki','Daihatsu','Isuzu','Bugatti','McLaren','Pagani','Koenigsegg','Citroen','Peugeot','Renault',
    'Dacia','Opel','Vauxhall','SsangYong','Tata','Mahindra','BYD','Geely','Great Wall','Chery','Nio',
    'Xpeng','Li Auto','Lotus','Datsun','Lada','Studebaker','Pontiac','Oldsmobile','Plymouth',
  ]},
  { id: 'social_media_apps', short: 'Social media apps', prompt: 'Name as many social media apps/platforms as you can.', answers: [
    'Facebook','Instagram','TikTok','Twitter','X','Snapchat','YouTube','Reddit','Pinterest','LinkedIn',
    'Threads','Mastodon','Bluesky','BeReal','Vine','Tumblr','Flickr','Meetup','Discord','Slack',
    'WhatsApp','Telegram','Signal','WeChat','Line','Viber','Skype','Zoom','Twitch','Vimeo','Periscope',
    'Clubhouse','Patreon','OnlyFans','SoundCloud','Spotify','Last.fm','Goodreads','Letterboxd','MySpace',
    'Friendster','Hi5','Orkut','Google Plus','Foursquare','Yelp','Houseparty','Marco Polo','Lemon8',
    'Quora','Tumblr','Habbo','Path','Ello','Vero','Substack','Medium','Wattpad','Yikyak','Whisper',
    'IFunny','9gag','Triller','Likee','Kuaishou','Sina Weibo','VKontakte','VK','Odnoklassniki',
  ]},
  { id: 'tech_companies', short: 'Tech companies', prompt: 'Name as many tech/software companies as you can.', answers: [
    'Apple','Microsoft','Google','Amazon','Meta','Facebook','Netflix','Tesla','Nvidia','AMD','Intel',
    'IBM','Oracle','Cisco','Adobe','Salesforce','SAP','Dell','HP','Lenovo','Asus','Acer','Samsung',
    'LG','Sony','Panasonic','Toshiba','Sharp','Foxconn','TSMC','Huawei','Xiaomi','Oppo','Vivo','OnePlus',
    'BlackBerry','Nokia','Motorola','Spotify','Snap','Snapchat','Pinterest','Twitter','X','TikTok',
    'ByteDance','Tencent','Alibaba','JD.com','Baidu','Naver','Kakao','Line','Rakuten','Mercado Libre',
    'Stripe','PayPal','Square','Block','Shopify','Etsy','eBay','Airbnb','Uber','Lyft','DoorDash',
    'Instacart','Grubhub','Postmates','Roblox','Epic Games','Activision','EA','Ubisoft','Take-Two','Valve',
    'GitHub','GitLab','Atlassian','Slack','Zoom','Dropbox','Box','OpenAI','Anthropic','Snowflake',
    'Databricks','Palantir','Cloudflare','Akamai','VMware','Splunk','ServiceNow','Workday',
    'Twilio','MongoDB','Redis','Elastic','HashiCorp','Confluent','DataDog','New Relic','Crowdstrike',
  ]},
  { id: 'browsers', short: 'Web browsers', prompt: 'Name as many web browsers as you can.', answers: [
    'Chrome','Firefox','Safari','Edge','Opera','Brave','Vivaldi','Arc','DuckDuckGo','Tor',
    'Internet Explorer','Netscape','Maxthon','UC Browser','Samsung Internet','Yandex','Pale Moon',
    'Waterfox','Lynx','Konqueror','SeaMonkey','Falkon','Midori','Min','Beaker','Puffin','Dolphin',
  ]},
  { id: 'streaming_services', short: 'Streaming services', prompt: 'Name as many streaming services as you can.', answers: [
    'Netflix','Hulu','Disney Plus','HBO Max','Max','Amazon Prime Video','Apple TV Plus','Paramount Plus',
    'Peacock','Discovery Plus','ESPN Plus','YouTube','YouTube TV','YouTube Premium','Sling TV','Fubo',
    'Pluto TV','Tubi','Crackle','Roku Channel','Crunchyroll','Funimation','HiDive','Shudder','BritBox',
    'Acorn TV','MUBI','Criterion Channel','Plex','Vudu','Spotify','Apple Music','Tidal','Amazon Music',
    'YouTube Music','Pandora','Deezer','SiriusXM','iHeartRadio','SoundCloud','Audible','Twitch','Kick',
  ]},

  // ── SPORTS / RECREATION (non-soccer) ──
  { id: 'olympic_summer_sports', short: 'Olympic summer sports', prompt: 'Name as many Summer Olympic sports as you can.', answers: [
    'Swimming','Diving','Water Polo','Synchronized Swimming','Artistic Swimming','Athletics','Track and Field',
    'Marathon','Gymnastics','Artistic Gymnastics','Rhythmic Gymnastics','Trampoline','Cycling','Mountain Bike',
    'BMX','Road Cycling','Track Cycling','Rowing','Canoeing','Kayaking','Sailing','Surfing','Skateboarding',
    'Climbing','Sport Climbing','Equestrian','Dressage','Show Jumping','Eventing','Fencing','Boxing',
    'Wrestling','Judo','Taekwondo','Karate','Weightlifting','Archery','Shooting','Modern Pentathlon',
    'Triathlon','Volleyball','Beach Volleyball','Basketball','3x3 Basketball','Handball','Hockey','Field Hockey',
    'Rugby','Rugby Sevens','Soccer','Football','Tennis','Table Tennis','Badminton','Golf','Baseball','Softball',
    'Breaking','Breakdancing',
  ]},
  { id: 'extreme_sports', short: 'Extreme sports', prompt: 'Name as many extreme sports as you can.', answers: [
    'Skateboarding','Surfing','Snowboarding','Skiing','Freestyle Skiing','Halfpipe','Slopestyle',
    'BMX','Motocross','Supercross','Freestyle Motocross','Mountain Biking','Downhill','Rock Climbing',
    'Bouldering','Free Solo','Ice Climbing','Parkour','Free Running','Skydiving','BASE Jumping',
    'Wingsuit Flying','Paragliding','Hang Gliding','Bungee Jumping','Cliff Diving','Whitewater Rafting',
    'Kayaking','Kitesurfing','Windsurfing','Wakeboarding','Sandboarding','Mountain Boarding','Slacklining',
    'Highlining','Cave Diving','Free Diving','Caving','Spelunking','Iceboating','Powerbocking','Slopestyle',
  ]},
  { id: 'wwe_wrestlers', short: 'WWE wrestlers', prompt: 'Name as many WWE wrestlers as you can.', answers: [
    'Hulk Hogan','Andre the Giant','Ric Flair','The Rock','Stone Cold','Stone Cold Steve Austin',
    'The Undertaker','Triple H','Shawn Michaels','Chris Jericho','Edge','Christian','Kane','Big Show',
    'Mick Foley','Mankind','Dude Love','Cactus Jack','John Cena','Randy Orton','Batista','CM Punk',
    'Jeff Hardy','Matt Hardy','Brock Lesnar','Roman Reigns','Seth Rollins','Dean Ambrose','Jon Moxley',
    'AJ Styles','Daniel Bryan','Bryan Danielson','Sami Zayn','Kevin Owens','Finn Balor','Bray Wyatt',
    'Rey Mysterio','Eddie Guerrero','Chris Benoit','Booker T','Rob Van Dam','Goldberg','Sting','Drew McIntyre',
    'Bobby Lashley','Cody Rhodes','Sheamus','Big E','Kofi Kingston','Xavier Woods','The New Day',
    'Trish Stratus','Lita','Beth Phoenix','Becky Lynch','Charlotte Flair','Sasha Banks','Bayley',
    'Bianca Belair','Rhea Ripley','Liv Morgan','Asuka','Iyo Sky','Tiffany Stratton',
    'Jey Uso','Jimmy Uso','LA Knight','Logan Paul','GUNTHER','Solo Sikoa','Damian Priest','Bron Breakker',
    'Macho Man Randy Savage','Bret Hart','Owen Hart','British Bulldog','Yokozuna','Diesel','Razor Ramon',
    'Ultimate Warrior','Junkyard Dog','Iron Sheik','Sgt Slaughter','Honky Tonk Man','Jake the Snake',
  ]},

  // ── SCIENCE / NATURE ──
  { id: 'elements', short: 'Chemical elements', prompt: 'Name as many chemical elements as you can.', answers: [
    'Hydrogen','Helium','Lithium','Beryllium','Boron','Carbon','Nitrogen','Oxygen','Fluorine','Neon',
    'Sodium','Magnesium','Aluminum','Aluminium','Silicon','Phosphorus','Sulfur','Sulphur','Chlorine','Argon',
    'Potassium','Calcium','Scandium','Titanium','Vanadium','Chromium','Manganese','Iron','Cobalt','Nickel',
    'Copper','Zinc','Gallium','Germanium','Arsenic','Selenium','Bromine','Krypton','Rubidium','Strontium',
    'Yttrium','Zirconium','Niobium','Molybdenum','Technetium','Ruthenium','Rhodium','Palladium','Silver',
    'Cadmium','Indium','Tin','Antimony','Tellurium','Iodine','Xenon','Cesium','Caesium','Barium',
    'Lanthanum','Cerium','Tungsten','Gold','Mercury','Lead','Platinum','Iridium','Osmium','Bismuth',
    'Radon','Radium','Uranium','Plutonium','Thorium','Americium','Polonium','Francium','Astatine',
    'Hafnium','Tantalum','Rhenium','Thallium','Curium','Californium','Einsteinium','Fermium',
  ]},
  { id: 'famous_scientists', short: 'Famous scientists', prompt: 'Name as many famous scientists as you can.', answers: [
    'Albert Einstein','Isaac Newton','Charles Darwin','Stephen Hawking','Marie Curie','Galileo Galilei',
    'Nikola Tesla','Thomas Edison','Alexander Graham Bell','Louis Pasteur','Gregor Mendel','Niels Bohr',
    'Richard Feynman','Carl Sagan','Neil deGrasse Tyson','Bill Nye','Jane Goodall','Dian Fossey',
    'James Watson','Francis Crick','Rosalind Franklin','Linus Pauling','Erwin Schrodinger','Max Planck',
    'Werner Heisenberg','Enrico Fermi','Robert Oppenheimer','Edwin Hubble','Carl Friedrich Gauss',
    'Leonhard Euler','Henri Poincare','Alan Turing','Ada Lovelace','Grace Hopper','Tim Berners-Lee',
    'Pythagoras','Archimedes','Euclid','Hippocrates','Avicenna','Aristotle','Plato','Socrates',
    'Antoine Lavoisier','Dmitri Mendeleev','Ernest Rutherford','J Robert Oppenheimer','James Maxwell',
    'Michael Faraday','Robert Hooke','Carl Linnaeus','Aristarchus','Copernicus','Nicolaus Copernicus',
    'Johannes Kepler','Tycho Brahe','Christiaan Huygens','Robert Boyle','Joseph Priestley','Edwin Hubble',
    'Carl Friedrich Gauss','Vera Rubin','Barbara McClintock','Rachel Carson','Sally Ride',
  ]},
  { id: 'planets_and_moons', short: 'Planets, dwarf planets, and moons', prompt: 'Name as many planets, dwarf planets, or moons in our solar system as you can.', answers: [
    'Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Ceres','Eris',
    'Makemake','Haumea','Moon','Luna','Phobos','Deimos','Io','Europa','Ganymede','Callisto',
    'Titan','Enceladus','Mimas','Tethys','Dione','Rhea','Iapetus','Hyperion','Phoebe','Pan',
    'Titania','Oberon','Umbriel','Ariel','Miranda','Triton','Nereid','Charon','Nix','Hydra','Styx','Kerberos',
  ]},
  { id: 'farm_animals', short: 'Farm animals', prompt: 'Name as many farm/barnyard animals as you can.', answers: [
    'Cow','Bull','Calf','Pig','Piglet','Sow','Boar','Sheep','Lamb','Ram','Ewe','Goat','Kid',
    'Horse','Foal','Mare','Stallion','Donkey','Mule','Chicken','Rooster','Hen','Chick','Turkey',
    'Duck','Drake','Duckling','Goose','Gosling','Gander','Rabbit','Bunny','Llama','Alpaca',
    'Cat','Kitten','Dog','Puppy','Mouse','Rat','Bee','Honeybee','Guinea Fowl','Peacock','Pheasant',
    'Quail','Ox','Yak','Buffalo','Water Buffalo','Reindeer','Emu','Ostrich','Pigeon','Dove',
  ]},
];

function normalizeAnswerEntry(entry) {
  if (Array.isArray(entry)) {
    const cleaned = entry.map(s => String(s).trim()).filter(Boolean);
    if (cleaned.length === 0) return null;
    if (cleaned.length === 1) return cleaned[0];
    // dedupe within array (case-insensitive)
    const seen = new Set();
    const out = [];
    for (const s of cleaned) {
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
    return out.length === 1 ? out[0] : out;
  }
  const s = String(entry).trim();
  return s || null;
}

function auditAndExpand(p) {
  if (!fs.existsSync(p)) { console.log(`skip (not found): ${p}`); return; }
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));

  // 1. Audit + normalize existing
  let fixedAnswers = 0;
  for (const cat of data) {
    cat.short = String(cat.short ?? '').trim();
    cat.prompt = String(cat.prompt ?? '').trim();
    if (!Array.isArray(cat.answers)) { cat.answers = []; continue; }
    const seenCanonical = new Set();
    const cleaned = [];
    for (const a of cat.answers) {
      const n = normalizeAnswerEntry(a);
      if (n === null) continue;
      const canonical = (Array.isArray(n) ? n[0] : n).toLowerCase();
      if (seenCanonical.has(canonical)) { fixedAnswers++; continue; }
      seenCanonical.add(canonical);
      cleaned.push(n);
    }
    if (cleaned.length !== cat.answers.length) fixedAnswers += cat.answers.length - cleaned.length;
    cat.answers = cleaned;
  }

  // 2. Append new categories (skip if id already present)
  const existing = new Set(data.map(c => c.id));
  let added = 0;
  for (const c of NEW) {
    if (existing.has(c.id)) continue;
    const cleaned = { ...c, answers: [] };
    const seen = new Set();
    for (const a of c.answers) {
      const n = normalizeAnswerEntry(a);
      if (n === null) continue;
      const canon = (Array.isArray(n) ? n[0] : n).toLowerCase();
      if (seen.has(canon)) continue;
      seen.add(canon);
      cleaned.answers.push(n);
    }
    data.push(cleaned);
    added++;
  }

  fs.writeFileSync(p, JSON.stringify(data));
  const total = data.reduce((n, c) => n + c.answers.length, 0);
  console.log(`${p}: ${data.length} categories (${total} answers). +${added} added, ${fixedAnswers} dupes/empties pruned.`);
}

for (const p of PATHS) auditAndExpand(p);
