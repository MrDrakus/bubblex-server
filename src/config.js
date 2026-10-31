module.exports = Object.seal({
// MultiOgarII configurations file
// Lines starting with // are comments

// [NOTES]
// MultiOgarII uses cell size instead of cell mass to improve performance!
// In order to get the cell size from mass value, you need to calculate using this formula:
//     size = SQRT( mass * 100 )

// [LOGGING]
"logVerbosity": 4,
"logFileVerbosity": 5,

// [SERVER]
"serverTimeout": 300,
"serverMaxConnections": 500,
"serverPort": 8080,
"serverBind": "0.0.0.0",
"serverTracker": 0,
"serverGamemode": 0,
"serverBots": 10,
"serverViewBaseX": 1920,
"serverViewBaseY": 1080,
"serverMinScale": 0.12,
"serverSpectatorScale": 0.35,
"serverStatsPort": -1,
"serverStatsUpdate": 60,
"mobilePhysics": 0,
"badWordFilter": 0,
"serverRestart": 0,

// [CLIENT]
"serverMaxLB": 10,
"serverChat": 1,
"serverChatAscii": 0,
"separateChatForTeams": 0,
"serverName": "BubbleX.pl #1",
"serverWelcome1": "Witaj na BubbleX.pl!",
"serverWelcome2": "Milej gry ze znajomymi!",
"clientBind": "",

// [ANTI-BOT]
"serverIpLimit": 10,
"serverMinionIgnoreTime": 30,
"serverMinionThreshold": 10,
"serverMinionInterval": 1000,
"serverScrambleLevel": 0,
"playerBotGrow": 0,

// [BORDER]
"borderWidth": 14142.135623730952,
"borderHeight": 14142.135623730952,

// [FOOD]
"foodMinSize": 12,
"foodMaxSize": 24,
"foodAmount": 1500,
"foodMassGrow": 1,

// [VIRUSES]
"virusMinSize": 100,
"virusMaxSize": 141.421356237,
"virusMaxPoppedSize": 60,
"virusEqualPopSize": 0,
"virusAmount": 40,
"virusMaxAmount": 80,
"motherCellMaxMass": 0,
"virusVelocity": 820,
"virusMaxCells": 0,

// [EJECTED MASS] - Mechanika Bubble.am
"ejectSize": 42.43,
"ejectSizeLoss": 46.90,
"ejectCooldown": 0,
"ejectSpawnPercent": 0,
"ejectVirus": 0,
"ejectVelocity": 860,

// [PLAYERS] - Dynamiczny split i fast-merge
"playerMinSize": 31.6227766017,
"playerMaxSize": 2000,
"playerMinSplitSize": 59.16079783,
"playerMinEjectSize": 59.16079783,
"playerStartSize": 45,
"playerMaxCells": 32,
"playerSpeed": 0.5,
"playerDecayRate": 0.001,
"playerDecayCap": 0,
"playerRecombineTime": 4,
"playerMaxNickLength": 20,
"playerDisconnectTime": -1,
"splitVelocity": 880,

// [MINIONS]
"minionStartSize": 31.6227766017,
"minionMaxStartSize": 31.6227766017,
"minionCollideTeam": 0,
"serverMinions": 0,
"defaultName": "minion",
"minionsOnLeaderboard": 0,

// [Gamemode]
})
