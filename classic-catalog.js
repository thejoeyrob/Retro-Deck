(()=>{
'use strict';
const R='https://raw.githubusercontent.com/libretro-thumbnails';
const repos={
  nes:'Nintendo_-_Nintendo_Entertainment_System',snes:'Nintendo_-_Super_Nintendo_Entertainment_System',gb:'Nintendo_-_Game_Boy',gbc:'Nintendo_-_Game_Boy_Color',gba:'Nintendo_-_Game_Boy_Advance',segaMD:'Sega_-_Mega_Drive_-_Genesis',n64:'Nintendo_-_Nintendo_64',atari2600:'Atari_-_2600'
};
const enc=s=>encodeURIComponent(s)+'.png';
const art=(platform,...names)=>names.filter(Boolean).map(n=>`${R}/${repos[platform]}/master/Named_Boxarts/${enc(n)}`);
const C=(rank,title,platform,year,genres,artNames,aliases=[])=>({rank,title,platform,year,genres,aliases,art:art(platform,...artNames)});
window.RETRO_DECK_CLASSICS=[
C(1,'Super Mario World','snes','1991',['platform','adventure'],['Super Mario World (USA)','Super Mario World (USA) (Rev 1)']),
C(2,'The Legend of Zelda: A Link to the Past','snes','1992',['adventure','action','rpg'],['Legend of Zelda, The - A Link to the Past (USA)','Legend of Zelda, The - A Link to the Past (USA) (Rev 1)'],['Zelda Link to the Past']),
C(3,'Chrono Trigger','snes','1995',['rpg','adventure'],['Chrono Trigger (USA)']),
C(4,'Super Metroid','snes','1994',['action','adventure','metroidvania'],['Super Metroid (Japan, USA) (En,Ja)']),
C(5,'Super Mario Bros. 3','nes','1990',['platform','action'],['Super Mario Bros. 3 (USA)','Super Mario Bros. 3 (USA) (Rev 1)']),
C(6,'The Legend of Zelda','nes','1987',['adventure','action'],['Legend of Zelda, The (USA) (Rev 1)','Legend of Zelda, The (USA)']),
C(7,'Mega Man 2','nes','1989',['action','platform'],['Mega Man 2 (USA)']),
C(8,'Contra','nes','1988',['action','run-and-gun','co-op'],['Contra (USA)']),
C(9,'Castlevania III: Dracula’s Curse','nes','1990',['action','platform'],["Castlevania III - Dracula's Curse (USA)"],["Castlevania III Dracula's Curse"]),
C(10,'Punch-Out!!','nes','1987',['sports','action'],['Mike Tyson\'s Punch-Out!! (USA) (Rev 1)','Punch-Out!! (USA)']),
C(11,'Kirby’s Adventure','nes','1993',['platform','action'],["Kirby's Adventure (USA)"],["Kirby's Adventure"]),
C(12,'Metroid','nes','1987',['action','adventure','metroidvania'],['Metroid (USA)']),
C(13,'DuckTales','nes','1989',['platform','action'],['DuckTales (USA)']),
C(14,'Tetris','gb','1989',['puzzle'],['Tetris (World) (Rev 1)','Tetris (World)']),
C(15,'Pokémon Red Version','gb','1998',['rpg','collection'],['Pokemon - Red Version (USA, Europe) (SGB Enhanced)'],['Pokemon Red','Pokémon Red']),
C(16,'Pokémon Gold Version','gbc','2000',['rpg','collection'],['Pokemon - Gold Version (USA, Europe) (SGB Enhanced) (GB Compatible)'],['Pokemon Gold','Pokémon Gold']),
C(17,'The Legend of Zelda: Link’s Awakening DX','gbc','1998',['adventure','action'],["Legend of Zelda, The - Link's Awakening DX (USA, Europe) (SGB Enhanced) (GB Compatible)"],["Zelda Link's Awakening"]),
C(18,'Super Mario Land 2: 6 Golden Coins','gb','1992',['platform','action'],['Super Mario Land 2 - 6 Golden Coins (USA, Europe) (Rev 2)']),
C(19,'Metroid II: Return of Samus','gb','1991',['action','adventure','metroidvania'],['Metroid II - Return of Samus (World)']),
C(20,'Donkey Kong','gb','1994',['platform','puzzle'],['Donkey Kong (World) (Rev 1) (SGB Enhanced)']),
C(21,'Advance Wars','gba','2001',['strategy','tactics'],['Advance Wars (USA)']),
C(22,'Metroid Fusion','gba','2002',['action','adventure','metroidvania'],['Metroid Fusion (USA)']),
C(23,'Pokémon Emerald Version','gba','2005',['rpg','collection'],['Pokemon - Emerald Version (USA, Europe)'],['Pokemon Emerald','Pokémon Emerald']),
C(24,'The Legend of Zelda: The Minish Cap','gba','2005',['adventure','action'],['Legend of Zelda, The - The Minish Cap (USA)'],['Zelda Minish Cap']),
C(25,'Mario & Luigi: Superstar Saga','gba','2003',['rpg','platform'],['Mario _ Luigi - Superstar Saga (USA)','Mario & Luigi - Superstar Saga (USA)']),
C(26,'Sonic the Hedgehog','segaMD','1991',['platform','action','speed'],['Sonic The Hedgehog (USA, Europe)','Sonic the Hedgehog (USA, Europe)']),
C(27,'Sonic the Hedgehog 2','segaMD','1992',['platform','action','speed'],['Sonic The Hedgehog 2 (World)','Sonic the Hedgehog 2 (World)']),
C(28,'Sonic the Hedgehog 3','segaMD','1994',['platform','action','speed'],['Sonic The Hedgehog 3 (USA)','Sonic the Hedgehog 3 (USA)']),
C(29,'Sonic & Knuckles','segaMD','1994',['platform','action','speed'],['Sonic _ Knuckles (World)','Sonic & Knuckles (World)']),
C(30,'Streets of Rage','segaMD','1991',['beat-em-up','action','co-op'],['Streets of Rage (World)']),
C(31,'Streets of Rage 2','segaMD','1992',['beat-em-up','action','co-op'],['Streets of Rage 2 (USA)']),
C(32,'Streets of Rage 3','segaMD','1994',['beat-em-up','action','co-op'],['Streets of Rage 3 (USA)']),
C(33,'Gunstar Heroes','segaMD','1993',['action','run-and-gun','co-op'],['Gunstar Heroes (USA)']),
C(34,'Shinobi III: Return of the Ninja Master','segaMD','1993',['action','platform'],['Shinobi III - Return of the Ninja Master (USA)']),
C(35,'Phantasy Star IV','segaMD','1995',['rpg','adventure'],['Phantasy Star IV (USA)']),
C(36,'Contra: Hard Corps','segaMD','1994',['action','run-and-gun','co-op'],['Contra - Hard Corps (USA, Korea)']),
C(37,'Castlevania: Bloodlines','segaMD','1994',['action','platform'],['Castlevania - Bloodlines (USA)']),
C(38,'Golden Axe','segaMD','1989',['beat-em-up','action','co-op'],['Golden Axe (World)']),
C(39,'Altered Beast','segaMD','1989',['beat-em-up','action'],['Altered Beast (USA, Europe)']),
C(40,'Paperboy','segaMD','1991',['arcade','action'],['Paperboy (USA, Europe)']),
C(41,'Earthworm Jim','segaMD','1994',['platform','action'],['Earthworm Jim (USA)']),
C(42,'Super Mario 64','n64','1996',['platform','adventure'],['Super Mario 64 (USA)']),
C(43,'The Legend of Zelda: Ocarina of Time','n64','1998',['adventure','action'],['Legend of Zelda, The - Ocarina of Time (USA) (Rev 2)'],['Zelda Ocarina of Time']),
C(44,'The Legend of Zelda: Majora’s Mask','n64','2000',['adventure','action'],["Legend of Zelda, The - Majora's Mask (USA)"],["Zelda Majora's Mask"]),
C(45,'GoldenEye 007','n64','1997',['shooter','action'],['GoldenEye 007 (USA)']),
C(46,'Mario Kart 64','n64','1997',['racing','multiplayer'],['Mario Kart 64 (USA)']),
C(47,'Star Fox 64','n64','1997',['shooter','action'],['Star Fox 64 (USA)']),
C(48,'Banjo-Kazooie','n64','1998',['platform','adventure'],['Banjo-Kazooie (USA)']),
C(49,'F-Zero X','n64','1998',['racing','action'],['F-Zero X (USA)']),
C(50,'Perfect Dark','n64','2000',['shooter','action'],['Perfect Dark (USA) (Rev 1)']),
C(101,'Mountain King','atari2600','1983',['platform','adventure','arcade'],['Mountain King (USA)'],['Mountain King Atari 2600'])
];
})();
