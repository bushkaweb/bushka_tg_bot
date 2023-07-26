require("dotenv").config();
const { google } = require("googleapis");
const stream = require("stream");
const axios = require("axios").default;
const fs = require('fs');
const path = require('path');

const parents_id = process.env["parents_announcement_id"];
const client_id = process.env["client_id"];
const client_secret = process.env["client_secret"];
const redirect_uri = process.env["redirect_uri"];
const refresh_token = process.env["refresh_token"];

const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
auth.setCredentials({ refresh_token });
const driveService = google.drive({ version: "v3", auth });

async function uploadPostPhoto(filePath, fileObj) {
  console.log(filePath);  

  const newFilePath = path.join(__dirname, "../", "cache", fileObj.file_name)

  fs.renameSync(filePath, newFilePath)

  const fileReadStream = fs.createReadStream(newFilePath)

  return await driveService.files
    .create({
      media: {
        mimeType: fileObj.mime_type,
        body: fileReadStream,
      },
      requestBody: {
        name: fileObj.file_name,
        parents: [parents_id],
      },
      fields: "id",
    })
    .then(async (data) => {
      console.log(data);
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
      fields: "webContentLink",
    });

    return result.data.webContentLink;
  } catch (e) {
    console.log(e);
    return null;
  }
}

module.exports = { uploadPostPhoto };
