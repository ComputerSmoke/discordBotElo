const Discord = require('discord.js');
const client = new Discord.Client();
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
	client.on('message', message => {
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

			switch(cmd[0]) {
				case "register":
					register(id, channel);
					break;
				case "rep":
					report(id, cmd, channel, mentions);
					break;
				case "help":
					sayHelp(channel);
					break;
				case "leaderboard":
					sayLeaderboard(id, channel);
					break;
				case "cancel":
					cancelRep(id, cmd, channel, mentions);
					break;
				case "looking":
					toggleLooking(id, channel, message.member);
					break;
				case "look":
					listLooking(id, channel);
					break;
				case "stats":
					sayStats(id, channel);
					break;
				case "playing":
					nowPlaying(id, channel);
					break;
				default:
					sayUnrec(channel);
			}
		} catch(e) {
			console.error(e);
		}
	});
});

async function nowPlaying(id, channel) {
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
			return;
		}
		if (res == "REMOVED_PLAYING") {
			channel.send("You canceled your game.")
			return;
		}
	});
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

		channel.send(new Discord.MessageEmbed()
			.setTitle("Your stats")
			.addField("Elo", res.elo, false)
			.addField("Wins", res.wins, true)
			.addField("Losses", res.losses, true)
			.addField("Draws", res.draws, true)
		);
	});
}

async function listLooking(channel) {
	database.listLooking(db).then(async res => {
		if (res == "DB_ERR") {
			channel.send("An internal database error occured, sorry for the inconvenience.");
			return;
		}
		if (res.length == 0) {
			channel.send("Currently, there are no players looking for a ranked match");
		}
		else {
			let msg = new Discord.MessageEmbed().setTitle("Users currently looking for a ranked match");
			for (let u of res) {
				let user = await client.users.fetch(u.discord_id.toString());
				msg.addField(user.username + "#" + user.discriminator, "Elo : " + u.elo);
			}
			channel.send(msg);
		}
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
			listLooking(channel);
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
	channel.send("-register\t:\tRegister for rated play\n-rep [W/L/D] [opponent]\t:\tReport the results of a rated game. Both players must do this.\n-leaderboard\t:\tView the leaderboard\n-looking\t:\tList yourself as looking for a rated game\n-look\t:\tView the list of players looking for a rated game\n-cancel [W/L/D] [player]\t:\tCancel a pending game report\n-stats\t:\tView your rating\n-playing\t:\tRemove yourself from the looking for game list until you report the results of a game");
}

async function sayLeaderboard(id, channel) {
	database.getLeaderboard(db).then(async res => {
		if (res == "DB_ERR") {
			channel.send("An internal database error occured, sorry for the inconvenience.");
			return;
		}
		else {
			if (res.length == 0) {
				channel.send("There are currently no players registered.");
			}
			else {
				let msg = new Discord.MessageEmbed().setTitle("Leaderboard");
				let lb = "";
				for (let i in res) {
					let usershown = false;
					if (i < 10) {
						let user = await client.users.fetch(res[i].discord_id.toString());
						let rank = parseInt(i) + 1;
						lb += rank.toString() + " : " + user.username + "#" + user.discriminator + " Elo : " + res[i].elo;

						if (res[i].discord_id == id) {
							usershown = true;
							lb += " <--- You";
						}

						lb += "\n"
					}
					else {
						if (!usershown) {
							if (res[i].discord_id == id) {
								lb += "\n...\n\n";

								let user = await client.users.fetch(res[i].discord_id.toString());
								let rank = parseInt(i) + 1;
								lb += rank.toString() + " : " + user.username + "#" + user.discriminator + " Elo : " + res[i].elo;

								usershown = true;
								lb += " <--- You";
								lb += "\n"
							}
						}
					}
				}
				msg.description = lb;
				channel.send(msg);
			}
		}
	});

}

async function report(id, cmd, channel, mentions) {
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
	return;
	try {
		var stat = await getStats('./save/accounts/'+id+'.txt');
		if(stat) {
			//file exists
			if(mentions.first()) {
				var stat2 = await getStats('./save/accounts/'+mentions.first().id+'.txt');
				if(stat2 && mentions.first().id != id) {
					if(playing[id] != null) {
						delete playing[id];
						var user = JSON.parse(await readFile('./save/accounts/'+id+'.txt', 'utf8'));
						looking[id] = {tag: user.tag, r: user.r, t: 0};
						console.log('added to looking');
					}
					

				} else {
					channel.send("I don't recognize that player. Make sure you use the format -rep [W/L/D] [player], and that they have registered.");
				}
			} else {
				channel.send("I don't recognize that player. Make sure you use the format -rep [W/L/D] [player], and that they have registered.");
			}
		} else {
			channel.send("You must first register with -register");
		}
	} catch(e) {
		console.error(e);
	}
	console.log("finished report");
}

async function rec(statsA, statsB, s, channel) {
	k = 25;

	ac = Math.ceil(k*(s-(1/(1+Math.pow(10,(statsB.elo-statsA.elo)/400)))));
	bc = Math.ceil(k*((1-s)-(1/(1+Math.pow(10,(statsA.elo-statsB.elo)/400)))));

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

	channel.send(new Discord.MessageEmbed()
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
		)
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
	var players = Object.keys(playing);
	for(var i = 0; i < players.length; i++) {
		var player = playing[players[i]];
		if(player > 0) {
			delete playing[players[i]];
		} else {
			player++;
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