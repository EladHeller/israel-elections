const fs = require('fs');
const archiver = require('archiver');

const output = fs.createWriteStream('csv-monitor.zip');
const archive = archiver('zip', {
  zlib: {level: 9}, // Sets the compression level.
});

output.on('close', () => {
  console.log(`${archive.pointer()} total bytes`);
  console.log('archiver has been finalized and the output file descriptor has closed.');
});

output.on('end', () => {
  console.log('Data has been drained');
});

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.log(err);
  } else {
    // throw error
    throw err;
  }
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

archive.directory('csv-monitor/', false);

// finalize the archive (ie we are done appending files but streams have to finish yet)
// 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
archive.finalize();
