require("dotenv").config();

const express = require("express");
const app = express();
const doesTheDogDie = require("./src/does-the-dog-die");
const { getCurrentGameByUsername } = require("./src/twitch");
const { twitchBot, handleBotClientMessage } = require("./src/twitch-bot");

const { TWITCH_CHANNELS_JSON } = process.env;
const CHANNELS = JSON.parse(TWITCH_CHANNELS_JSON);

twitchBot.on("connected", () => {
  const currentChannels = twitchBot
    .getChannels()
    .map(channelWithHash => channelWithHash.substring(1));

  CHANNELS.forEach(channel => {
    if (currentChannels.includes(channel)) {
      return;
    }

    twitchBot.join(channel);
  });
});

twitchBot.on("message", async (channelWithHash, _data, message) => {
  const channel = channelWithHash.substring(1);

  if (!message.includes("!cw") && !message.includes("!contentwarning")) {
    return;
  }

  const gameTitle = await getCurrentGameByUsername(channel);

  try {
    const { contentWarnings, url } = await doesTheDogDie({
      gameTitle,
      isSensitiveEnabled: true
    });

    if (contentWarnings && contentWarnings.length === 0) {
      twitchBot.say(
        channel,
        `Didn't find any crowdsourced content warnings for “${gameTitle}”. See more at ${url}.`
      );
      return;
    }

    const contentWarningsString = contentWarnings.join(", ");
    twitchBot.say(
      channel,
      `Content warnings for “${gameTitle}”: ${contentWarningsString}. See more at ${url}.`
    );
  } catch (e) {
    twitchBot.say(
      channel,
      `Couldn't find any content warnings for “${gameTitle}” on doesthedogdie.com...`
    );
  }
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
