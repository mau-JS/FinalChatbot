const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

async function downloadFile(bucketName, srcFilename, destFilename) {
  const storage = new Storage();

  const options = {
    // The path to which the file should be downloaded, e.g. "./local/path/to/file.txt"
    destination: destFilename,
  };

  // Downloads the file
  await storage.bucket(bucketName).file(srcFilename).download(options);

  console.log(`Downloaded file ${srcFilename} from bucket ${bucketName} to ${destFilename}`);
}

async function processDocument(projectId, location, processorId, filePath) {
    const documentaiClient = new DocumentProcessorServiceClient();
    const resourceName = documentaiClient.processorPath(projectId, location, processorId);

    const imageFile = fs.readFileSync(filePath);
    const extension = path.extname(filePath).substring(1);
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
    console.log(result.document.text);

    // Delete the file
    fs.unlinkSync(filePath);
    console.log(`Deleted file ${filePath}`);
}

const bucketName = 'mybucket124';  // TODO: replace with your bucket name
const srcFilename = 'test.pdf';  // TODO: replace with the name of your file in the bucket
const destFilename = './test.pdf';  // TODO: replace with the local path where you want to save the file

const projectId = 'documentprincipal';  // TODO: replace with your project ID
const location = 'us';  // TODO: replace with the location of your processor, e.g. 'us'
const processorId = 'ec2a4b2ae9b1054e';  // TODO: replace with your processor ID

downloadFile(bucketName, srcFilename, destFilename)
  .then(() => processDocument(projectId, location, processorId, destFilename))
  .catch(console.error);
