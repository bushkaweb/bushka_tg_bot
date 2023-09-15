require('dotenv').config();
const {google} = require('googleapis');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid').v4;

const cachePath = path.join(__dirname, '../', 'cache');
const parentsId = process.env['parents_announcement_id'];

let credentialsPath = '/etc/secrets/credentials.json';

if (!fs.existsSync(credentialsPath)) {
  credentialsPath = path.join(__dirname, '../', 'credentials.json');
}
const credentialsContent = fs.readFileSync(credentialsPath);
const credentials = JSON.parse(credentialsContent)['web'];

const auth = new google.auth.OAuth2({
  clientId: credentials['client_id'],
  clientSecret: credentials['client_secret'],
  redirectUri: credentials['redirect_uris'][0],
});

let tokenPath = '/etc/secrets/token.json';
if (!fs.existsSync(tokenPath)) {
  tokenPath = path.join(__dirname, '../', 'token.json');
}
const tokensContent = fs.readFileSync(tokenPath);
const tokens = JSON.parse(tokensContent);
auth.setCredentials(tokens);

auth.refreshAccessToken((err, tokens) => {
  if (err) {
    return console.log(err);
  }

  auth.setCredentials(tokens);
});

const driveService = google.drive({version: 'v3', auth});

/**
 * Upload photo to Google Drive
 *
 * @param {*} bot
 * @param {*} fileObj
 * @return {String}
 */
async function uploadPostPhoto(bot, fileObj) {
  const dirId = uuid();
  const dirPath = path.join(cachePath, dirId);

  fs.mkdirSync(dirPath);

  const fileId = fileObj.file_id;
  const filePath = await bot.downloadFile(fileId, dirPath);

  const fileReadStream = fs.createReadStream(filePath);

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
      })
      .finally((result) => {
        fs.unlinkSync(filePath);
        fs.rmdirSync(dirPath);
        return result;
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
