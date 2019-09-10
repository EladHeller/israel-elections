const {S3} = require('aws-sdk');
const fs = require('fs');
const {region} = require('./config');

const s3 = new S3({region});

const upload = async (key, contentType, body) => s3.upload({
  Bucket: 'elections-client',
  Key: key,
  ACL: 'public-read',
  ContentType: contentType,
  Body: body,
}).promise();
const main = async () => {
  await upload('index.html', 'text/html', fs.readFileSync('./elections-client/index.html'));
  await upload('index.js', 'application/javascript', fs.readFileSync('./elections-client/index.js'));
  await upload('show-svg.js', 'application/javascript', fs.readFileSync('./elections-client/show-svg.js'));
  await upload('index.css', 'text/css', fs.readFileSync('./elections-client/index.css'));
  await upload('preview.png', 'image/png', fs.readFileSync('./elections-client/preview.png'));
};

main().then(console.log).catch(console.error);
