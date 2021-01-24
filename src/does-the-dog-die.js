const fetch = require("node-fetch");
const cache = require("memory-cache");

const { DOES_THE_DOG_DIE_API_KEY } = process.env;
const ITEM_TYPE_VIDEO_GAME_NAME = "Video Game";
const ITEM_TYPE_VIDEO_GAME_ID = 17;

const API_BASE = "https://www.doesthedogdie.com/";

const CACHE_KEY = "DOES_THE_DOG_DIE";
const CACHE_TIMEOUT_MS = 60 * 1000; // 1 minute

async function callApi({ endpoint }) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      Accept: "application/json",
      "X-API-KEY": DOES_THE_DOG_DIE_API_KEY
    }
  });
  return response.json();
}

async function searchGamesByGameTitle(gameTitle) {
  if (!gameTitle || gameTitle.length === 0) {
    throw new Error(`No game title sent to search`);
  }

  const json = await callApi({ endpoint: `dddsearch?q=${gameTitle}` });
  const { items } = json;

  if (!items || items.length === 0) {
    throw new Error(`Couldn't find any items for "${gameTitle}"`);
  }

  const games = items.filter(item => {
    return (
      item.itemType.id === ITEM_TYPE_VIDEO_GAME_ID ||
      item.itemType.name === ITEM_TYPE_VIDEO_GAME_NAME
    );
  });

  if (!games || games.length === 0) {
    throw new Error(`Couldn't find any games for "${gameTitle}"`);
  }

  return games;
}

async function getGameInfoById({ id, isSensitiveEnabled }) {
  const json = await callApi({ endpoint: `media/${id}` });

  if (!json || !json.topicItemStats || json.topicItemStats.length === 0) {
    throw new Error("No topic items for media id", id);
  }

  const topicsWithYesRatings = json.topicItemStats
    .filter(topicItem => {
      const isYes = topicItem.isYes === 1;
      const isSensitive = isSensitiveEnabled
        ? topicItem.topic.isSensitive
        : true;
      return isYes && isSensitive;
    })
    .map(topicItem => topicItem.topic.TopicCategory.name)
    .filter((value, index, self) => {
      return self.indexOf(value) === index;
    });

  return { contentWarnings: topicsWithYesRatings };
}

async function doesTheDogDie({ gameTitle, isSensitiveEnabled }) {
  const [game] = await searchGamesByGameTitle(gameTitle);
  const { id } = game;
  const { contentWarnings } = await getGameInfoById({ id, isSensitiveEnabled });

  return {
    contentWarnings,
    url: `doesthedogdie.com/media/${id}`
  };
}

async function cachedDoesTheDogDie({ gameTitle, isSensitiveEnabled }) {
  const cacheKey = `${CACHE_KEY}${gameTitle}${
    isSensitiveEnabled ? "isSensitiveEnabled" : "isSensitiveDisabled"
  }`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const results = await doesTheDogDie({ gameTitle, isSensitiveEnabled });

  cache.put(cacheKey, results, CACHE_TIMEOUT_MS);

  return results;
}

module.exports = cachedDoesTheDogDie;
