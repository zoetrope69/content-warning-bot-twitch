const fetch = require("node-fetch");
const cache = require("memory-cache");
const { stringify: queryStringStringify } = require("qs");
const logger = require("./helpers/logger");

const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = process.env;

const CACHE_KEY = "TWITCH_BROADCASTER_ID";
const CACHE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

async function getOAuthToken() {
  const queryString = queryStringStringify({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials"
  });

  const url = `https://id.twitch.tv/oauth2/token?${queryString}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.twitchtv.v5+json"
    }
  });

  const json = await response.json();

  if (!json.access_token) {
    throw new Error("No access token.");
  }

  return json.access_token;
}

async function callTwitchAPI(endpoint, options, fetchOptions) {
  const oAuthToken = await getOAuthToken();
  const queryString = queryStringStringify(options);
  const url = `https://api.twitch.tv/helix/${endpoint}?${queryString}`;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/vnd.twitchtv.v5+json",
        Authorization: `Bearer ${oAuthToken}`,
        "Client-Id": TWITCH_CLIENT_ID,
        "Content-Type": "application/json"
      },
      ...fetchOptions
    });
  } catch (e) {
    logger.error("💩 Twitch API", e);
  }

  if (!response) {
    return {};
  }

  const rateLimit = response.headers.get("ratelimit-limit");
  const rateLimitRemaining = response.headers.get("ratelimit-remaining");

  if (rateLimitRemaining / rateLimit < 0.33) {
    logger.error(
      "💩 Twitch API",
      `Twitch API Call Rate limit: ${rateLimitRemaining}/${rateLimit}`
    );
  }

  // no content
  if (response.status === 204) {
    return {};
  }

  const json = await response.json();

  if (json.error) {
    logger.error("💩 Twitch API", json.message);
  }

  if (!json) {
    logger.error("💩 Twitch API", `No data for: ${url}`);
    return;
  }

  return json;
}

async function getBroadcasterByUsername(username) {
  const response = await callTwitchAPI("users", {
    login: username
  });

  const { data } = response;

  if (!data || data.length === 0) {
    return {};
  }

  return data[0];
}

async function getCachedBroadcasterIdByUsername(username) {
  const cacheKey = `${CACHE_KEY}${username}`;
  const cachedBroadcasterId = cache.get(cacheKey);
  if (cachedBroadcasterId) {
    return cachedBroadcasterId;
  }

  const broadcaster = await getBroadcasterByUsername(username);

  cache.put(cacheKey, broadcaster.id, CACHE_TIMEOUT_MS);

  return broadcaster.id;
}

async function getChannelInfo(broadcasterId) {
  const response = await callTwitchAPI("channels", {
    broadcaster_id: broadcasterId
  });

  const { data } = response;

  if (!data || data.length === 0) {
    return {};
  }

  const {
    broadcaster_id,
    broadcaster_name,
    broadcaster_language,
    title,
    game_id,
    game_name
  } = data[0];

  return {
    id: broadcaster_id,
    username: broadcaster_name,
    title,
    language: broadcaster_language,
    categoryId: game_id,
    categoryName: game_name
  };
}

async function getCurrentGameByUsername(username) {
  const broadcasterId = await getCachedBroadcasterIdByUsername(username);
  const channelInfo = await getChannelInfo(broadcasterId);
  return channelInfo.categoryName;
}

module.exports = {
  getCurrentGameByUsername
};
