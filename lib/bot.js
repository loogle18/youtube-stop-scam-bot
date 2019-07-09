const rp = require('request-promise');
const { apiKey } = require('../config');
const STOP_SCAM_BOT_CHANNEL_ID = 'UCCgbU1sGTcrSpShqdgc-VMQ';
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};

const getCommentText = (authorName) => {
  return `Scam comment detected.\n${authorName} stop misleading people.`;
};

const listReqGenerator = async function* (fn, options) {
  let result = await fn(options);
  let pageToken = result.nextPageToken;
  yield (result ? result.items : []);
  while (result && pageToken) {
    result = await fn({ ...options, pageToken });
    pageToken = result.nextPageToken;
    yield (result ? result.items : []);
  }
};

const search = ({ publishedAfter, pageToken = undefined }) => {
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
    console.log(err.message);
    return [];
  });
};

const getComments = ({ videoId, pageToken = undefined }) => {
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
    console.log(err.message);
    return [];
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
    console.log(err.message);
    return null;
  });
};

const checkIfScamComment = (commentText) => {
  const trueScamCommentPattern = new RegExp('(ton-token.*?info|tonmarket.*?site|ton-gram|sale-gram)', 'gi');
  const tokenPattern = new RegExp('(gram|ton|telegram|телеграм)', 'gi');
  const callToActionPattern = new RegExp('(купи|советую|возможность|достало ждать)', 'gi');

  if (trueScamCommentPattern.test(commentText) || tokenPattern.test(commentText)) {
    if (callToActionPattern.test(commentText)) {
      console.log(commentText);
      return true;
    }
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
    console.log(err);
    return false;
  }
};

const runProccess = async () => {
  let publishedAfter = new Date();
  publishedAfter.setDate(publishedAfter.getDate() - 7);
  let searchGenerator =  listReqGenerator(search, { publishedAfter });
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
    await sleep(30 * 60000); // 30m
  }
};

module.exports = { 
  main
};
