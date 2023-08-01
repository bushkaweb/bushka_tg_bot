require('dotenv').config();
const {google} = require('googleapis');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid').v4;
const config = require('config');

const cachePath = path.join(__dirname, '../', 'cache');
const parentsId = process.env['parents_announcement_id'];
const clientId = process.env['client_id'];
const clientSecret = process.env['client_secret'];
const redirectUri = process.env['redirect_uri'];

const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const refreshTokenDelay = config.get('REFRESH_TOKEN_DELAY');

/**
 * Update Google OAuth refresh token
 */
async function updateRefreshAndAccessToken() {
  const content = fs.readFileSync('/etc/secrets/token.json');
  const tokens = JSON.parse(content);
  auth.setCredentials(tokens);
}

let driveService;

/**
 * Start auth
 */
function start() {
  updateRefreshAndAccessToken();
  setInterval(() => {
    updateRefreshAndAccessToken();
    driveService = google.drive({version: 'v3', auth});
  }, refreshTokenDelay);
}
start();

/**
 * Upload photo to Google Drive
 *
 * @param {*} bot
 * @param {*} fileObj
 * @return {String}
 */
async function uploadPostPhoto(bot, fileObj) {
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath);
  }

  const cacheFileDir = uuid();
  const cacheFileDirPath = path.join(cachePath, cacheFileDir);

  if (!fs.existsSync(cacheFileDirPath)) {
    fs.mkdirSync(cacheFileDirPath);
  }

  const fileId = fileObj.file_id;
  const newFilePath = await bot.downloadFile(fileId, cacheFileDirPath)
      .catch(console.log);

  const fileReadStream = fs.createReadStream(newFilePath);

  return await driveService.files
      .create({
        media: {
          mimeType: fileObj.mime_type,
          body: fileReadStream,
        },
        requestBody: {
          name: fileObj.file_name,
          parents: [parentsId],
        },
        fields: 'id',
      })
      .then(async (data) => {
        return await generatePublicUrl(data.data.id);
      })
      .catch((e) => {
        console.log(e);
        return null;
      });
}

/**
 * Generate public link to Google Drive file
 *
 * @param {*} fileId
 * @return {String}
 */
async function generatePublicUrl(fileId) {
  try {
    const result = await driveService.files.get({
      fileId: fileId,
      fields: 'webContentLink',
    });

    return result.data.webContentLink;
  } catch (e) {
    console.log(e);
    return null;
  }
}

module.exports = {uploadPostPhoto};
