require("dotenv").config();

const express = require("express");
const app = express();
const doesTheDogDie = require("./src/does-the-dog-die");
const { getCurrentCategoryByUsername } = require("./src/twitch");
const { twitchBot, handleBotClientMessage } = require("./src/twitch-bot");
const { getUsers, getUser, deleteUser, createUser } = require("./src/db");

const { TWITCH_BOT_USERNAME, TWITCH_IGNORED_CATEGORIES_JSON } = process.env;
const TWITCH_IGNORED_CATEGORIES = JSON.parse(TWITCH_IGNORED_CATEGORIES_JSON);

console.log(
  `[Content Warning Bot] Ignored categories: ${TWITCH_IGNORED_CATEGORIES.join(
    ", "
  )}`
);

twitchBot.on("connected", () => {
  const currentChannels = twitchBot
    .getChannels()
    .map(channelWithHash => channelWithHash.substring(1));

  const users = getUsers();

  users.forEach(user => {
    if (currentChannels.includes(user.username)) {
      return;
    }

    twitchBot.join(user.username);
  });
});

async function handleMessagesSentInContentWarningBotChannel(
  channel,
  message,
  username
) {
  console.log({ message, username });
  const existingUser = getUser(username);
  console.log({ existingUser });

  if (message.includes("!start") || message.includes("!join")) {
    if (existingUser) {
      twitchBot.say(
        channel,
        `@${username}, you have already started using the bot. Make sure to mod me with: /mod ContentWarningBot...`
      );
      return;
    }

    try {
      await twitchBot.join(username);
      createUser(username);
      twitchBot.say(
        channel,
        `@${username}, you have started using the bot. Make sure to mod me with: /mod ContentWarningBot. Try !cw or !contentwarning in your channel's chat.`
      );
    } catch (e) {
      console.error(e);
      twitchBot.say(
        channel,
        `@${username}, something went wrong. Please try again later...`
      );
    }

    return;
  }

  if (message.includes("!stop") || message.includes("!leave")) {
    if (!existingUser) {
      twitchBot.say(channel, `@${username}, you have stopped using the bot.`);
      return;
    }

    try {
      await twitchBot.part(username);
      deleteUser(username);
      twitchBot.say(channel, `@${username}, you have stopped using the bot.`);
    } catch (e) {
      console.error(e);
      twitchBot.say(
        channel,
        `@${username}, something went wrong. Please try again later...`
      );
    }

    return;
  }
}

async function handleContentWarningMessage(channel) {
  const categoryName = await getCurrentCategoryByUsername(channel);

  console.log("categoryName", categoryName);

  if (!categoryName || categoryName.length === 0) {
    twitchBot.say(
      channel,
      `No content warnings for streams with no category/game`
    );
    return;
  }

  if (TWITCH_IGNORED_CATEGORIES.includes(categoryName)) {
    twitchBot.say(channel, `No content warnings for “${categoryName}”`);
    return;
  }

  try {
    const { contentWarnings, url } = await doesTheDogDie({
      gameTitle: categoryName,
      isSensitiveEnabled: true
    });

    if (contentWarnings && contentWarnings.length === 0) {
      twitchBot.say(
        channel,
        `Didn't find any crowdsourced content warnings for “${categoryName}”. See more at ${url}`
      );
      return;
    }

    const contentWarningsString = contentWarnings.join(", ");
    twitchBot.say(
      channel,
      `Content warnings for “${categoryName}”: ${contentWarningsString}. See more at ${url}`
    );
  } catch (e) {
    twitchBot.say(
      channel,
      `Couldn't find any content warnings for “${categoryName}” on doesthedogdie.com...`
    );
  }
}

twitchBot.on("message", async (channelWithHash, data, message) => {
  const channel = channelWithHash.substring(1);
  const { username } = data;

  // if it's the bot saying things don't do anything
  if (username.toLowerCase() === TWITCH_BOT_USERNAME.toLowerCase()) {
    return;
  }

  if (channel.toLowerCase() === TWITCH_BOT_USERNAME.toLowerCase()) {
    await handleMessagesSentInContentWarningBotChannel(
      channel,
      message,
      username
    );
    return;
  }

  if (message.includes("!cw") || message.includes("!contentwarning")) {
    await handleContentWarningMessage(channel);
    return;
  }
});

app.get("/", (request, response) => {
  response.send("hello");
});

app.get("/restart", () => {
  process.exit();
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
