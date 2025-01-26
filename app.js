const Discord = require('discord.js');
const client = new Discord.Client({intents: Object.values(Discord.GatewayIntentBits)
/*[

Discord.GatewayIntentBits.Guilds,
Discord.GatewayIntentBits.GuildMessages,
Discord.GatewayIntentBits.GuildMembers,
Discord.GatewayIntentBits.MessageContent
]*/
});
const fs = require('fs');
const {promisify} = require('util');
const readFile = promisify(fs.readFile);
const sqlite3 = require('sqlite3');
const database = require('./database.js');

var db = new sqlite3.Database("./database.db");

const config = JSON.parse(fs.readFileSync("./config.json"));

var pendingReports = {};

var channelId = config.channelId;

client.once('ready', () => {
	console.log('Ready!');
	client.on('messageCreate', message => {
		if (!(message.content.startsWith("'") ||
			message.content.startsWith("`") ||
			message.content.startsWith("-")) ||
			message.author.bot ||
			(message.channel.id != channelId))
			return;
		try {
			var cmd = message.content.toLowerCase().slice(1).split(/ +/);

			var channel = message.channel;
			var mentions = message.mentions.users;
			var tag = message.author.tag;

			var id = message.author.id;
			var member = message.member;

			let arg = -1;
			if(cmd.length > 1) {
				arg = cmd[1];
			}

			switch(cmd[0]) {
				case "register":
					register(id, channel);
					break;
				case "rep":
					report(id, cmd, channel, mentions, member);
					break;
				case "help":
					sayHelp(channel);
					break;
				case "leaderboard":
					sayLeaderboard(id, channel, arg);
					break;
				case "cancel":
					cancelRep(id, cmd, channel, mentions);
					break;
				case "looking":
					toggleLooking(id, channel, member);
					break;
				case "stats":
					sayStats(id, channel);
					break;
				case "playing":
					nowPlaying(id, channel, member);
					break;
				default:
					sayUnrec(channel);
			}
		} catch(e) {
			console.error(e);
		}
	});
});

async function nowPlaying(id, channel, member) {
	database.togglePlaying(db, id).then(res => {
		if (res == "NOT_LOOKING") {
			channel.send("I didn't do anything because you weren't listed as looking for a game, but you can still report your results afterward with -rep [W/L/D] [player]")
			return;
		}
		if (res == "DB_ERR") {
			channel.send("An internal database error occured, sorry for the inconvenience.");
			return;
		}
		if (res == "MARKED_PLAYING") {
			channel.send("You have been temporarily removed from the looking list, and will be re-added when you report game results. Good luck! (If you wish to cancel, run the -playing command again.)");
			member.roles.remove(config.roleId);
			return;
		}
		if (res == "REMOVED_PLAYING") {
			channel.send("You canceled your game.")
			member.roles.add(config.roleId);
			return;
		}
	});
}

Discord.EmbedBuilder.prototype.addField = function(a,b,c){
  if(c===undefined){
    this.addFields([{name:a,value:b}])
  }
  else{
    this.addFields([{name:a,value:b,inline:c}])
  }
}

async function sayStats(id, channel) {
	database.getStats(db, id).then(res => {
		if (res == "NOT_REGISTERED") {
			channel.send("You are not registered. Please register first with the command -register.")
			return;
		}
		if (res == "DB_ERR") {
			channel.send("An internal database error occured, sorry for the inconvenience.");
			return;
		}

		channel.send({embeds:[new Discord.EmbedBuilder()
			.setTitle("Your stats")
			.addFields([{name:"Elo", value:res.elo.toString(), inline:false},
				{name:"Wins", value:res.wins.toString(), inline:true},
				{name:"Losses", value:res.losses.toString(), inline:true},
				{name:"Draws",value:res.draws.toString(),inline:true}]
			)]}
		);
	});
}

async function toggleLooking(id, channel, member) {
	database.toggleLooking(db, id).then(res => {
		if (res == "NOT_REGISTERED") {
			channel.send("You are not registered. Please register first with the command -register.")
			return;
		}
		if (res == "DB_ERR") {
			channel.send("An internal database error occured, sorry for the inconvenience.");
			return;
		}
		if (res == "MARKED_LOOKING") {
			channel.send("You are now marked as looking for a ranked match.");
			member.roles.add(config.roleId);
			return;
		}
		if (res == "REMOVED_LOOKING") {
			channel.send("You are no longer marked as looking for a ranked match / playing a ranked match.");
			member.roles.remove(config.roleId);
			return;
		}
	});
}

async function cancelRep(id, cmd, channel, mentions) {
	try {
		if(id && mentions.first()) {
			if(pendingReports[id] && pendingReports[id][mentions.first().id]) {
				if(cmd[1] == "w") {
					if(pendingReports[id][mentions.first().id].w > 0) {
						pendingReports[id][mentions.first().id].w--;
						channel.send("Your pending win report has been canceled.");
					} else {
						channel.send("You have no pending win reports to cancel with this player. They may have timed out or been confirmed");
					}
				} else if(cmd[1] == "l") {
					if(pendingReports[id][mentions.first().id].l > 0) {
						pendingReports[id][mentions.first().id].l--;
						channel.send("Your pending loss report has been canceled.");
					} else {
						channel.send("You have no pending loss reports to cancel with this player. They may have timed out or been confirmed");
					}
				} else if(cmd[1] == "d") {
					if(pendingReports[id][mentions.first().id].d > 0) {
						pendingReports[id][mentions.first().id].d--;
						channel.send("Your pending draw report has been canceled.");
					} else {
						channel.send("You have no pending draw reports to cancel with this player. They may have timed out or been confirmed");
					}
				} else {
					channel.send("I don't understand if you want to cancel a win, loss, or draw. Be sure to use the format -cancel [W/L/D] [player]");
				}
			} else {
				channel.send("You have no pending reports to cancel with this player");
			}
		} else {
			channel.send("I don't know who you're canceling against. Please cancel with the format -cancel [W/L/D] [player]");
		}
	} catch(e) {
		console.error(e);
	}
}

async function sayHelp(channel) {
	channel.send("-register\t:\tRegister for rated play\n-rep [W/L/D] [opponent]\t:\tReport the results of a rated game. Both players must do this.\n-leaderboard [Index]\t:\tView the leaderboard\n-looking\t:\tList yourself as looking for a rated game\n-cancel [W/L/D] [player]\t:\tCancel a pending game report\n-stats\t:\tView your rating\n-playing\t:\tRemove yourself from the looking for game list until you report the results of a game");
}

async function sayLeaderboard(id, channel, arg) {
	database.getLeaderboard(db).then(async res => {
		if (res == "DB_ERR") {
			channel.send("An internal database error occured, sorry for the inconvenience.");
			return;
		}
		else {
			if (res.length == 0) {
				channel.send("There are currently no players registered.");
			} else {
				let msg = new Discord.EmbedBuilder().setTitle("Leaderboard");
				let lb = "";
				let usershown = false;
				//print top 10
				for (let i = 0; i < res.length && i < 10; i++) {
					let user = await client.users.fetch(res[i].discord_id.toString());
					let rank = i + 1;
					lb += rank.toString() + " : " + user.username + "#" + user.discriminator + " Elo : " + res[i].elo;

					if (res[i].discord_id == id) {
						usershown = true;
						lb += " <--- You";
					}
					lb += "\n"
				}
				if(arg != -1) {
					try {
						arg = parseInt(arg);
					} catch {
						arg = -1;
					}
				}
				let printMore = true;
				if(arg == -1 || arg < 10 || arg > res.length) {
					printMore = false;
					if (!usershown){
						for(let i = 10; i < res.length; i++) {
							if (res[i].discord_id == id) {
								arg = i + 1;
								printMore = true;
								break;
							}
						}
						if(!printMore) {
							lb += "Complete 4 ranked matches to be placed on the leaderboard.";
						}
					}
				}
				if(printMore){
					let startIdx = arg-2;
					if (Math.max(startIdx,10)!=10){
						 lb += "...\n";
					}
					for(let i = Math.max(startIdx,10); i < startIdx+3 && i < res.length; i++) {
						let user = await client.users.fetch(res[i].discord_id.toString());
						let rank = i + 1;
						lb += rank.toString() + " : " + user.username + "#" + user.discriminator + " Elo : " + res[i].elo;

						if(res[i].discord_id == id) {
							lb += " <--- You";
						}
						if(i == startIdx+2 && i != res.length-1) lb += "\n..."
							lb += "\n"
						}
					}
				msg.setDescription(lb);
				channel.send({embeds:[msg]});
			}
		}
	});
}

async function report(id, cmd, channel, mentions, member) {
	database.getStats(db, id).then(res => {
		if (res == "DB_ERR") {
			channel.send("An internal database error occured, sorry for the inconvenience.");
			return;
		}
		if (res == "NOT_REGISTERED") {
			channel.send("You are not registered. Run -register before using this command.")
			return;
		}
		let statsA = res;
		if (mentions.first()) {
			database.getStats(db, mentions.first().id).then(res => {
				if (res == "DB_ERR") {
					channel.send("An internal database error occured, sorry for the inconvenience.");
					return;
				}
				if (res == "NOT_REGISTERED") {
					channel.send("I don't recognize that player. Make sure you use the format -rep [W/L/D] [player], and that they have registered.");
					return;
				}
				let statsB = res;
				if (mentions.first().id != id) {
					database.removePlaying(db, id).then(res => {
						if (res == "DB_ERR") {
							channel.send("An internal database error occured, sorry for the inconvenience.");
							return;
						} else if (res == "OK_UPDATED") {
							member.roles.add(config.roleId);
						}
						var confirmed = false;
						if (pendingReports[mentions.first().id] && pendingReports[mentions.first().id][id]) {
							if (cmd[1] == "w" && pendingReports[mentions.first().id][id].l > 0) {
								pendingReports[mentions.first().id][id].l--;
								rec(statsA, statsB, 1, channel);
								confirmed = true;
								channel.send("Your win has been confirmed.");
							} else if (cmd[1] == "l" && pendingReports[mentions.first().id][id].w > 0) {
								pendingReports[mentions.first().id][id].w--;
								rec(statsA, statsB, 0, channel);
								confirmed = true;
								channel.send("Your loss has been confirmed.");
							} else if (cmd[1] == "d" && pendingReports[mentions.first().id][id].d > 0) {
								pendingReports[mentions.first().id][id].d--;
								rec(statsA, statsB, .5, channel);
								confirmed = true;
								channel.send("Your draw has been confirmed.");
							}
							console.log("checking reports");
							if (pendingReports[mentions.first().id][id].w == 0 && pendingReports[mentions.first().id][id].l == 0 && pendingReports[mentions.first().id][id].d == 0) {
								delete pendingReports[mentions.first().id][id];
								var reportCount = Object.keys(pendingReports[mentions.first().id]).length;
								if (reportCount < 1) {
									delete pendingReports[mentions.first().id];
								}
							}
							console.log("removed reports");
						}
						if (!confirmed) {
							if (!pendingReports[id]) {
								pendingReports[id] = {};
							}
							if (!pendingReports[id][mentions.first().id]) {
								pendingReports[id][mentions.first().id] = { w: 0, l: 0, d: 0, t: 0 }
							}
							if (cmd[1] == "w") {
								pendingReports[id][mentions.first().id].w++;
								channel.send("Your win has been reported, and will be confirmed when your opponent reports their corresponding loss.");
							} else if (cmd[1] == "l") {
								pendingReports[id][mentions.first().id].l++;
								channel.send("Your loss has been reported, and will be confirmed when your opponent reports their corresponding win.");
							} else if (cmd[1] == "d") {
								pendingReports[id][mentions.first().id].d++;
								channel.send("Your draw has been reported, and will be confirmed when your opponent reports their corresponding draw.");
							} else {
								channel.send("I don't understand if it was a win, loss, or draw. Be sure to use the format -rep [W/L/D] [player]")
							}
						}
					});
				}
				else {
					channel.send("You cannot report results against yourself.");
				}
			})
		}
		else {
			channel.send("I don't recognize that player. Make sure you use the format -rep [W/L/D] [player], and that they have registered.");
		}
	});
}

async function rec(statsA, statsB, s, channel) {
	k = 25;

	ac = Math.ceil(k*(s-(1/(1+Math.pow(10,(statsB.elo-statsA.elo)/400)))));
	bc = Math.ceil(k*((1-s)-(1/(1+Math.pow(10,(statsA.elo-statsB.elo)/400)))));
	if(s > 0) {
		bc--;
	} else {
		ac--;
	}

	var achar = "";
	if(ac > 0) {
		achar = "+";
	}
	var bchar = "";
	if(bc > 0) {
		bchar = "+";
	}

	statsA.elo += ac;
	statsB.elo += bc;

	if(s == 1) {
		statsA.wins++;
		statsB.losses++;
	} else if(s == .5) {
		statsA.draws++;
		statsB.draws++;
	} else if(s == 0) {
		statsA.losses++;
		statsB.wins++;
	}

	if (await database.updateStats(db, statsA.discord_id, statsA) == "DB_ERR") {
		channel.send("An internal database error occured, sorry for the inconvenience.");
	}
	if (await database.updateStats(db, statsB.discord_id, statsB) == "DB_ERR") {
		channel.send("An internal database error occured, sorry for the inconvenience.");
	}
	let userA = await client.users.fetch(statsA.discord_id);
	let userB = await client.users.fetch(statsB.discord_id);

	channel.send({embeds:[new Discord.EmbedBuilder()
		.setTitle("New Ratings")
		.addField(userA.username + "#" + userA.discriminator,
			"Elo : "      + statsA.elo + " (" + achar + ac + ")" +
			"\nWins : "   + statsA.wins +
			"\nLosses : " + statsA.losses +
			"\nDraws : "  + statsA.draws
		)
		.addField(userB.username + "#" + userB.discriminator,
			"Elo : " + statsB.elo + " (" + bchar + bc + ")" +
			"\nWins : " + statsB.wins +
			"\nLosses : " + statsB.losses +
			"\nDraws : " + statsB.draws
		)]}
	);
}

async function getUser(id) {
	try {
		var user = JSON.parse(await readFile('./save/accounts/'+id+'.txt', 'utf8'));
		console.log("user: " + user);
		return user;
	} catch(e) {
		console.error(e);
	}
}

async function sayUnrec(channel) {
	channel.send("Unrecognized command. Use -help for more info.");
}

async function register(id, channel) {
	database.registerUser(db, id).then(res => {
		if (res == "OK") {
			channel.send("You were registered successfully.");
			return;
		}
		if (res == "ALREADY_CREATED") {
			channel.send("You already are registered as an user.");
		}
		if (res == "DB_ERR") {
			channel.send("An internal database error occured, sorry for the inconvenience.");
			return;
		}
	});
}

setInterval(function() {
	var reporters = Object.keys(pendingReports);
	for(var i = 0; i < reporters.length; i++) {
		var reporter = reporters[i];
		var reports = Object.keys(pendingReports[reporters[i]]);
		for(var j = 0; j < reports.length; j++) {
			var reportee = reports[j];
			var report = pendingReports[reporter][reportee];
			if(report.t == 0) {
				report.t++;
			} else {
				delete pendingReports[reporter][reportee];
			}
		}
		var reportCount = Object.keys(pendingReports[reporters[i]]).length;
		if(reportCount < 1) {
			delete pendingReports[reporters[i]];
		}
	}
}, 21600000);

database.initialize(db).then(res => {
	if (res == "OK") {
		client.login(config.auth);
	}
	else {
		console.log("FATAL ERROR : failed to initialize database.");
		process.exit(1);
	}
})
