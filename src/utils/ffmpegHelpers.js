const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const ffmpeg = require('ffmpeg-static');

function transcodeToOpus(stream, logger) {
  if (!ffmpeg) {
    throw new Error('ffmpeg binary was not found. Install ffmpeg-static dependency.');
  }

  const ff = spawn(ffmpeg, [
    '-loglevel',
    'error',
    '-i',
    'pipe:0',
    '-ac',
    '2',
    '-ar',
    '48000',
    '-f',
    'opus',
    '-acodec',
    'libopus',
    'pipe:1',
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  stream.pipe(ff.stdin);

  const output = new PassThrough();
  ff.stdout.pipe(output);

  ff.stderr.on('data', (data) => logger?.debug?.('[ffmpeg]', data.toString()));

  const handleError = (error) => {
    if (!output.destroyed) output.destroy(error);
    ff.kill('SIGKILL');
  };

  ff.on('error', handleError);
  stream.on('error', handleError);

  ff.on('close', (code) => {
    if (code !== 0 && !output.destroyed) {
      output.destroy(new Error(`ffmpeg exited with code ${code}`));
    }
  });

  return output;
}

module.exports = {
  transcodeToOpus,
};
