require("dotenv").config();
const { google } = require("googleapis");
const stream = require("stream");
const {fetchUrl} = require('fetch');

const parents_id = process.env["parents_announcement_id"];
const client_id = process.env["client_id"];
const client_secret = process.env["client_secret"];
const redirect_uri = process.env["redirect_uri"];
const refresh_token = process.env["refresh_token"];

const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
auth.setCredentials({ refresh_token });
const driveService = google.drive({ version: "v3", auth });

async function uploadPostPhoto(fileLink, fileObj) {
  const file = await fetchUrl(fileLink)
    .then(async (res) => await res.arrayBuffer())
    .catch((e) => {
      console.log(e);
      return null;
    });

  const bufferStream = new stream.PassThrough();
  const buffer = Buffer.from(file);
  bufferStream.end(buffer);

  return await driveService.files
    .create({
      media: {
        mimeType: fileObj.mime_type,
        body: bufferStream,
      },
      requestBody: {
        name: fileObj.file_name,
        parents: [parents_id],
      },
      fields: "id,name",
    })
    .then(async (data) => {
      return await generatePublicUrl(data.data.id);
    })
    .catch((e) => {
      console.log(e);
      return null;
    });
}

async function generatePublicUrl(fileId) {
  try {
    const result = await driveService.files.get({
      fileId: fileId,
      fields: "webViewLink, webContentLink",
    });

    if (result.data.webViewLink) {
      return result.data.webContentLink;
    }

    return null;
  } catch (e) {
    console.log(e);
    return null;
  }
}

module.exports = { uploadPostPhoto };
