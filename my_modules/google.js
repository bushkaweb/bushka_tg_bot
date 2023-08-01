require('dotenv').config();
const {google} = require('googleapis');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid').v4;

const parentsId = process.env['parents_announcement_id'];
const clientId = process.env['client_id'];
const clientSecret = process.env['client_secret'];
const redirectUri = process.env['redirect_uri'];
const refreshToken = process.env['refresh_token'];

const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
auth.refreshAccessToken((err, tokens) => {
  if (err) {
    console.log(err);
    return null;
  }

  auth.setCredentials({refreshToken: tokens.refresh_token});
})
const driveService = google.drive({version: 'v3', auth});

const cachePath = path.join(__dirname, '../', 'cache');

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
