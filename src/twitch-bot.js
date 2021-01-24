const tmi = require("tmi.js");
const logger = require("./helpers/logger");

const {
  TWITCH_CLIENT_ID,
  TWITCH_BOT_OAUTH_TOKEN,
  TWITCH_BOT_USERNAME
} = process.env;

const botClient = new tmi.Client({
  options: {
    clientId: TWITCH_CLIENT_ID,
    debug: true,
    messagesLogLevel: "info"
  },
  connection: {
    reconnect: true,
    secure: true
  },
  identity: {
    username: TWITCH_BOT_USERNAME,
    password: TWITCH_BOT_OAUTH_TOKEN
  },
  channels: [],
  logger: {
    info: message => logger.info("🤖 Twitch Bot", message),
    warn: message => logger.warn("🤖 Twitch Bot", message),
    error: message => logger.error("🤖 Twitch Bot", message)
  }
});

botClient.connect().catch(e => {
  logger.error("🤖 Twitch Bot", e);
});

logger.info("🤖 Twitch Bot", "Starting...");

botClient.on("part", channel => {
  logger.info("🤖 Twitch Bot", `Left: ${channel}`);
});

botClient.on("connected", () => {
  logger.info("🤖 Twitch Bot", `Connected`);
});

botClient.on("join", channel => {
  logger.info("🤖 Twitch Bot", `Joined channel: ${channel}`);
});

botClient.on("error", err => {
  logger.error("🤖 Twitch Bot", err);
});

botClient.on("close", () => {
  logger.info("🤖 Twitch Bot", "Closed bot IRC connection");
});

async function handleBotClientMessage(channel, data, message, self) {
  const { badges, emotes, mod: isMod, color } = data;
  const username = data["display-name"];
  const isBroadcaster = badges && badges.broadcaster === 1;

  let [command, ...commandArguments] = message.split(" ");

  return {
    channel: channel.substring(1),
    isBot: self,
    isMod,
    isBroadcaster,
    message,
    user: {
      username,
      color
    }
  };
}

module.exports = {
  twitchBot: botClient,
  handleBotClientMessage
};
