const crypto = require('crypto');
const mime = require('mime-types');
const path = require('path');
const {S3} = require('aws-sdk');
const {bucket, region} = require('./config');

const s3 = new S3({region});

const md5 = (data) => crypto.createHash('md5').update(data).digest('hex');

const isFileAlreadyExists = async (key, stream) => {
  try {
    const {ETag, ContentLength} = await s3.headObject({Bucket: bucket, Key: key}).promise();
    const equal = stream.length === ContentLength;
    if (!equal) {
      return false;
    }
    return md5(stream) === JSON.parse(ETag);
  } catch (e) {
    return false;
  }
};


const upload = async (key, body) => s3.upload({
  Bucket: bucket,
  Key: key,
  ACL: 'public-read',
  ContentType: mime.contentType(path.extname(key)) || 'application/octet-stream',
  Body: body,
}).promise();

module.exports = {
  upload,
  isFileAlreadyExists,
};
