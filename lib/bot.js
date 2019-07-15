const rp = require('request-promise');
const { apiKey } = require('../config');
const {
  STOP_SCAM_BOT_EMAIL_ADDR,
  STOP_SCAM_BOT_CHANNEL_ID
} = process.env;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};

var getCommentText = (authorName) => {
  let text = 'Scam comment detected.\n';
  text += `@${authorName} stop misleading people.\n`;
  text += 'If you think this is a mistake and your comment is not a scam\n';
  text += `please send me a corresponding email to ${STOP_SCAM_BOT_EMAIL_ADDR}\n`;
  text += '-----------------------------------------------------------------\n';
  text += 'Обнаружен мошеннический комментарий.\n';
  text += `@${authorName} прекратите вводить людей в заблуждение.\n`;
  text += 'Если вы считаете это ошибкой и ваш комментарий не подразумевает мошенничество\n';
  text += `пожалуйста, отправьте мне соответствующее письмо на ${STOP_SCAM_BOT_EMAIL_ADDR}`;
  return text;
};

const listReqGenerator = async function* (fn, options) {
  let result = await fn(options);
  let pageToken = (result || {}).nextPageToken;
  yield (result ? result.items : []);
  while (result && pageToken) {
    result = await fn({ ...options, pageToken });
    pageToken = (result || {}).nextPageToken;
    yield (result ? result.items : []);
  }
};

const search = ({ publishedAfter, pageToken }) => {
  return rp({
    uri: `${YOUTUBE_API_BASE_URL}/search`,
    qs: {
      part: 'snippet',
      q: 'Биткоин',
      publishedAfter: publishedAfter,
      order: pageToken ? undefined : 'date',
      maxResults: 50,
      pageToken: pageToken,
      key: apiKey
    },
    json: true
  }).then((response) => {
    return response;
  }).catch((err) => {
    console.error(err.message);
    return null;
  });
};

const getComments = ({ videoId, pageToken }) => {
  return rp({
    uri: `${YOUTUBE_API_BASE_URL}/commentThreads`,
    qs: {
      part: 'snippet,replies',
      videoId: videoId,
      textFormat: 'plainText',
      maxResults: 100,
      pageToken: pageToken,
      key: apiKey
    },
    json: true
  }).then((response) => {
    return response;
  }).catch((err) => {
    console.error(err.message);
    return null;
  });
};

const replyToScamComment = (comment) => {
  return rp({
    method: 'POST',
    uri: `${YOUTUBE_API_BASE_URL}/comments`,
    qs: {
      part: 'snippet',
      key: apiKey,
      access_token: global.youtubeAccessToken
    },
    body: {
      snippet: {
        textOriginal: getCommentText(comment.snippet.topLevelComment.snippet.authorDisplayName),
        parentId: comment.id,
        videoId: comment.snippet.videoId
      }
    },
    json: true
  }).then((response) => {
    console.log(`\
      Reply to scam comment:
        parentId: ${comment.id},
        videoId: ${comment.snippet.videoId},
        author: ${comment.snippet.topLevelComment.snippet.authorDisplayName}
        comment: ${comment.snippet.topLevelComment.snippet.textOriginal}
    `);
    return response;
  }).catch((err) => {
    console.error(err.message);
    return null;
  });
};

const checkIfScamComment = (commentText) => {
  let scamSites = [
    'ton-token.*info',
    'tonmarket.*site',
    'ton-gram',
    'sale-gram',
    'gramton.*net',
    'mygram.*site.*buygram',
    'newgram.*info.*toncoin',
    'infotelegram.*pro.*ton.*gram',
    'linkdivident.*info.*air.*link',
    'linkairdrop.*info.*link.*token',
    'tokenlink.*site.*chainlink'
  ];
  const trueScamSitesPattern = new RegExp(scamSites.join('|'), 'gi');

  if (trueScamSitesPattern.test(commentText)) {
    console.log(commentText);
    return true;
  }
  return false;
};

const commentAlreadyReported = (replies) => {
  let result = false;
  if (replies && replies.comments) {
    for (let comment of replies.comments) {
      if (comment.snippet.authorChannelId.value === STOP_SCAM_BOT_CHANNEL_ID) {
        result = true;
        break;
      }
    }
  }
  return result;
};

const getScamComments = (comment) => {
  try {
    if (comment) {
      let text = comment.snippet.topLevelComment.snippet.textOriginal;
      if (checkIfScamComment(text) && !commentAlreadyReported(comment.replies)) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error(err);
    return false;
  }
};

const runProccess = async () => {
  let publishedAfter = new Date();
  publishedAfter.setHours(publishedAfter.getHours() - 24);
  let searchGenerator = listReqGenerator(search, { publishedAfter });
  for await (let searchResult of searchGenerator) {
    if (searchResult.length) {
      console.log(`Get ${searchResult.length}`);
      let videoIds = searchResult.map(({ id: { videoId } }) => videoId);
      console.log(`Video Ids: ${videoIds}`);
      videoIds.forEach(async (videoId) => {
        let commentsGenerator = listReqGenerator(getComments, { videoId });
        for await (let comments of commentsGenerator) {
          console.log(`Get ${comments.length} comments`);
          let scamComments = comments.filter(getScamComments);
          console.log(`Get ${scamComments.length} scam comments`);
          await Promise.all(scamComments.map(replyToScamComment));
        }
      });
    }
  }
};

const main = async () => {
  while (true) {
    await runProccess();
    await sleep(60 * 60000 * 24); // 24h
  }
};

module.exports = {
  main
};
