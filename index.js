const {Storage} = require('@google-cloud/storage');
const axios = require('axios');
const stream = require('stream');
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

// Creates a client
const storage = new Storage();

async function saveToBucket(bucketName, url, destinationBlobName) {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(destinationBlobName);

  // Get the file from the URL
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  const reader = response.data.pipe(new stream.PassThrough());

  // Uploads a local file to the bucket
  await new Promise((resolve, reject) =>
    reader.pipe(file.createWriteStream()).on('error', reject).on('finish', resolve)
  );
}

async function downloadFromBucket(bucketName, sourceBlobName, destinationFilePath) {
  const options = {
    // The path to which the file should be downloaded, e.g. "./file.txt"
    destination: destinationFilePath,
  };

  // Downloads the file
  await storage.bucket(bucketName).file(sourceBlobName).download(options);
}

async function processDocument(projectId, location, processorId, filePath) {
  const documentaiClient = new DocumentProcessorServiceClient();
  const resourceName = documentaiClient.processorPath(projectId, location, processorId);
  const imageFile = fs.readFileSync(filePath);
  const extension = filePath.split('.').pop();
  let mimeType;
  switch (extension) {
    case 'pdf':
      mimeType = 'application/pdf';
      break;
    case 'png':
      mimeType = 'image/png';
      break;
    case 'jpg':
    case 'jpeg':
      mimeType = 'image/jpeg';
      break;
    case 'tiff':
      mimeType = 'image/tiff';
      break;
    default:
      throw new Error(`Unsupported file extension: ${extension}`);
  }
  const rawDocument = {
    content: imageFile,
    mimeType: mimeType,
  };
  const request = {
    name: resourceName,
    rawDocument: rawDocument
  };
  const [result] = await documentaiClient.processDocument(request);

  // Delete the file
  fs.unlinkSync(filePath);

  return result.document;
}

app.post('/webhook', async (req, res) => {
  // Log the entire request body
  //console.log(req.body);

  // Extract the payload from the incoming request
  const payload = req.body.payload;

  // Now you can access the data in the payload
  const data = payload.data;
  const message = data.message;
  const attachments = message.attachments;

  // Loop through each attachment and log the URL
  attachments.forEach(attachment => {
    const filePayload = attachment.payload;
    const url = filePayload.url;
    console.log('File URL:', url);
  });

  // Check if the incoming request has a queryResult field
  if (req.body.queryResult) {
    // Check if the queryResult has an event field
    if (req.body.queryResult.event) {
      // Check if the event has a name field
      if (req.body.queryResult.event.name) {
        // Now you can safely access req.body.queryResult.event.name
        if (req.body.queryResult.event.name === 'FACEBOOK_MEDIA') {
          // Extract the image URL from the incoming Facebook Messenger request
          const url = req.body.queryResult.event.parameters.fields.attachment.structValue.fields.payload.structValue.fields.url.stringValue;

          const bucketName = 'mybucket124';  // TODO: replace with your bucket name
          const destinationBlobName = 'test.pdf';  // TODO: replace with the name you want to give to the object in your bucket
          const destinationFilePath = './test.pdf';  // TODO: replace with the path where you want to download the file
          const projectId = 'documentprincipal';  // TODO: replace with your project ID
          const location = 'us';  // TODO: replace with your processor location
          const processorId = 'ec2a4b2ae9b1054e';  // TODO: replace with your processor ID

          // Upload the file to the bucket
          await saveToBucket(bucketName, url, destinationBlobName);

          // Download the file from the bucket
          await downloadFromBucket(bucketName, destinationBlobName, destinationFilePath);

          // Process the document
          const document = await processDocument(projectId, location, processorId, destinationFilePath)

          const entities = document.entities.map(entity => `${entity.type}: ${entity.mentionText}`);

          // Extract the PSID from the incoming webhook event
          const psid = req.body.sender.id;

          // Create a Facebook Messenger-compatible response
          const facebookResponse = {
            "recipient": {
              "id": psid
            },
            "message": {
              "text": entities.join(', ')
            }
          };

          // Send the response to Facebook Messenger
          axios.post('https://graph.facebook.com/v2.6/me/messages?access_token=EAAKExSNuM4MBO93qB4qZCb2g29LfqLYnzn7i7U1qR2mVQNObgigpf9wmg4xnOa0zai9eYU7T1SRhcVKXohZAsA4DspXT5ecAIbySZCyblRBQYrCXNshf2gkjFHiuEKyNW0I7MIuXiHTFZCoPzfIDXei3meJ8gtX7wXxEbDpQKCHEwvCVYXx0JvgSYRreLVW3T75LxrQ6', facebookResponse)
            .then(response => {
              // Handle the response
             // console.log(req.body.payload.data.message);
              //console.log(req.body.payload.data.recipient);
              // console.log(req.body.payload.data.sender);

            })
            .catch(error => {
              // Handle the error
              console.error(error);
            });

          res.sendStatus(200);
        }
      }
    }
  }
});

app.listen(3000, () => {
  console.log('Webhook is running on port 3000');
});
